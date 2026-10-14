package com.mealplanner.server;

import com.mealplanner.server.config.DataInitializer;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.context.ApplicationContext;
import org.springframework.context.annotation.Import;

import static org.assertj.core.api.Assertions.assertThat;

@SpringBootTest
@Import(TestcontainersConfiguration.class)
class MealPlannerApplicationTests {

	@Autowired
	private ApplicationContext applicationContext;

	@Test
	void contextLoads() {
	}

	@Test
	void doesNotSeedSampleDataOutsideDevProfile() {
		assertThat(applicationContext.getBeanNamesForType(DataInitializer.class)).isEmpty();
	}

}
