package db.migration;

import com.mealplanner.server.product.ProductSearchText;
import org.flywaydb.core.api.migration.BaseJavaMigration;
import org.flywaydb.core.api.migration.Context;

import java.sql.PreparedStatement;
import java.sql.ResultSet;
import java.sql.Statement;

public class V6__fill_product_search_text extends BaseJavaMigration {

    @Override
    public void migrate(Context context) throws Exception {
        try (Statement select = context.getConnection().createStatement();
             ResultSet products = select.executeQuery("SELECT id, name, brand FROM products");
             PreparedStatement update = context.getConnection()
                     .prepareStatement("UPDATE products SET search_text = ? WHERE id = ?")) {
            while (products.next()) {
                update.setString(1, ProductSearchText.of(products.getString("name"), products.getString("brand")));
                update.setObject(2, products.getObject("id"));
                update.addBatch();
            }
            update.executeBatch();
        }
    }
}
