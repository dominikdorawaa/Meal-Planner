package db.migration;

import com.mealplanner.server.product.ProductSearchText;
import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;

import java.sql.Connection;
import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.util.UUID;

public class V6__fill_product_search_text extends BaseJavaMigration {

    static final int DEFAULT_CHUNK_SIZE = 1000;

    private final int chunkSize;

    public V6__fill_product_search_text() {
        this(DEFAULT_CHUNK_SIZE);
    }

    public V6__fill_product_search_text(int chunkSize) {
        this.chunkSize = chunkSize;
    }

    @Override
    public void migrate(Context context) throws Exception {
        Connection connection = context.getConnection();
        try (PreparedStatement select = connection.prepareStatement(
                     "SELECT id, name, brand FROM products WHERE id > ? ORDER BY id LIMIT ?");
             PreparedStatement update = connection.prepareStatement(
                     "UPDATE products SET search_text = ? WHERE id = ?")) {
            UUID lastId = new UUID(0, 0);
            int filled;
            do {
                filled = 0;
                select.setObject(1, lastId);
                select.setInt(2, chunkSize);
                try (ResultSet products = select.executeQuery()) {
                    while (products.next()) {
                        lastId = products.getObject("id", UUID.class);
                        update.setString(1, ProductSearchText.of(products.getString("name"), products.getString("brand")));
                        update.setObject(2, lastId);
                        update.addBatch();
                        filled++;
                    }
                }
                update.executeBatch();
            } while (filled == chunkSize);
        }
    }
}
