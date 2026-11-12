package kz.korkem.invoice.config;

import kz.korkem.invoice.properties.AuthProperties;
import kz.korkem.invoice.properties.CompanyProperties;
import kz.korkem.invoice.properties.JwtProperties;
import kz.korkem.invoice.properties.VatProperties;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Configuration;

/** Binds every application.yml section the app reads (app.*) in one place. */
@Configuration
@EnableConfigurationProperties({JwtProperties.class, AuthProperties.class, CompanyProperties.class, VatProperties.class})
public class PropertiesConfig {}
