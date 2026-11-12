package kz.korkem.invoice.config;

import io.swagger.v3.oas.models.Components;
import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Info;
import io.swagger.v3.oas.models.security.SecurityRequirement;
import io.swagger.v3.oas.models.security.SecurityScheme;
import kz.korkem.invoice.properties.AuthProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Swagger / OpenAPI description. Requests from Swagger UI are authenticated by the same login cookie
 * as the app; a bearer token (the JWT) works too.
 */
@Configuration
public class OpenApiConfig {

    private static final String COOKIE = "cookie";
    private static final String BEARER = "bearer";

    @Bean
    OpenAPI openApi(AuthProperties auth) {
        String version = OpenApiConfig.class.getPackage().getImplementationVersion();
        return new OpenAPI()
                .info(new Info().title("Korkem API")
                        .description("Log in with POST /api/auth/login (or in the app): the cookie is then sent with every request.")
                        .version(version == null ? "dev" : version))
                .components(new Components()
                        .addSecuritySchemes(COOKIE, new SecurityScheme().type(SecurityScheme.Type.APIKEY)
                                .in(SecurityScheme.In.COOKIE).name(auth.cookie().name()))
                        .addSecuritySchemes(BEARER, new SecurityScheme().type(SecurityScheme.Type.HTTP)
                                .scheme("bearer").bearerFormat("JWT")))
                .addSecurityItem(new SecurityRequirement().addList(COOKIE))
                .addSecurityItem(new SecurityRequirement().addList(BEARER));
    }
}
