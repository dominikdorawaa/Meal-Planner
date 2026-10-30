package db.migration;

import com.mealplanner.server.product.ProductSearchText;
import lombok.extern.slf4j.Slf4j;
import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Types;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Slf4j
public class V17__link_recipe_ingredients_to_products extends BaseJavaMigration {

    private static final String UNLINKED_INGREDIENTS = """
            SELECT ri.id, ri.name, r.created_by
            FROM recipe_ingredients ri
            LEFT JOIN recipes r ON r.id = ri.recipe_id
            WHERE ri.product_id IS NULL
            """;

    private static final String CANDIDATE_PRODUCTS = """
            SELECT id, name
            FROM products
            WHERE deleted_at IS NULL
              AND status <> 'REJECTED'
              AND (status = 'VERIFIED' OR created_by = ?)
              AND (search_text = ? OR search_text LIKE ?)
            """;

    @Override
    public void migrate(Context context) throws Exception {
        Connection connection = context.getConnection();
        List<UnlinkedIngredient> unlinked = unlinkedIngredients(connection);
        int linked = 0;
        try (PreparedStatement candidates = connection.prepareStatement(CANDIDATE_PRODUCTS);
             PreparedStatement update = connection.prepareStatement(
                     "UPDATE recipe_ingredients SET product_id = ? WHERE id = ?")) {
            for (UnlinkedIngredient ingredient : unlinked) {
                UUID productId = onlyMatchingProduct(candidates, ingredient);
                if (productId != null) {
                    update.setObject(1, productId);
                    update.setObject(2, ingredient.id());
                    update.addBatch();
                    linked++;
                }
            }
            update.executeBatch();
        }
        log.info("Linked {} recipe ingredients to products, {} still without a product", linked, unlinked.size() - linked);
    }

    private static List<UnlinkedIngredient> unlinkedIngredients(Connection connection) throws Exception {
        List<UnlinkedIngredient> unlinked = new ArrayList<>();
        try (PreparedStatement select = connection.prepareStatement(UNLINKED_INGREDIENTS);
             ResultSet rows = select.executeQuery()) {
            while (rows.next()) {
                unlinked.add(new UnlinkedIngredient(rows.getObject("id", UUID.class), rows.getString("name"),
                        rows.getObject("created_by", UUID.class)));
            }
        }
        return unlinked;
    }

    private static UUID onlyMatchingProduct(PreparedStatement candidates, UnlinkedIngredient ingredient) throws Exception {
        String name = ProductSearchText.normalize(ingredient.name());
        if (name.isEmpty()) {
            return null;
        }
        candidates.setObject(1, ingredient.owner(), Types.OTHER);
        candidates.setString(2, name);
        candidates.setString(3, name + " %");
        List<UUID> matches = new ArrayList<>();
        try (ResultSet products = candidates.executeQuery()) {
            while (products.next()) {
                if (name.equals(ProductSearchText.normalize(products.getString("name")))) {
                    matches.add(products.getObject("id", UUID.class));
                }
            }
        }
        return matches.size() == 1 ? matches.getFirst() : null;
    }

    private record UnlinkedIngredient(UUID id, String name, UUID owner) {
    }
}
