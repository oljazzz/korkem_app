package kz.korkem.invoice.service;

import static org.junit.jupiter.api.Assertions.assertEquals;

import java.math.BigDecimal;
import java.util.List;

import kz.korkem.invoice.entities.Product;
import org.junit.jupiter.api.Test;

class ProductGroupingSuggesterTest {

    private static Product product(String name) {
        Product p = new Product();
        p.setName(name);
        p.setPrice(BigDecimal.valueOf(2700));
        return p;
    }

    @Test
    void normalisesNames() {
        assertEquals(List.of("СТАТУС", "ПФ-115", "БЕЛЫЙ"), ProductGroupingSuggester.tokens("* СТАТУС * ПФ - 115 БЕЛЫЙ 2.6кг"));
        assertEquals(List.of("PUFAMIX", "№1", "ЧЕРНЫЙ"), ProductGroupingSuggester.tokens("PUFAMIX № 1 ЧЕРНЫЙ"));
        assertEquals(List.of("КОЛЕР", "КОЛЛЕКЦИЯ", "12"), ProductGroupingSuggester.tokens("КОЛЕР КОЛЛЕКЦИЯ  12  ( 450МЛ )"));
    }

    @Test
    void splitsProductLinesButNotColourCodes() {
        // Same price, but primer (ГФ-021) and enamel (ПФ-115) are different products
        var novo = ProductGroupingSuggester.clusters(List.of(
                product("НОВОКОЛОР ГФ - 021 СЕРАЯ 2.6кг"), product("НОВОКОЛОР ГФ - 021 СЕРЫЙ 2.6кг"),
                product("НОВОКОЛОР ПФ - 115 БЕЛЫЙ 2.6кг"), product("НОВОКОЛОР ПФ - 115 СИНИЙ 2.6кг")));
        assertEquals(2, novo.size());
        // A line with a single product (the grey primer) is left out instead of joining the enamels
        var status = ProductGroupingSuggester.clusters(List.of(
                product("СТАТУС ГФ - 021 СЕРЫЙ 2.6кг"), product("СТАТУС ПФ - 115 БЕЛЫЙ 2.6кг"),
                product("СТАТУС ПФ - 115 СИНИЙ 2.6кг"), product("СТАТУС ПФ - 115 КРАСНЫЙ 2.6кг")));
        assertEquals(1, status.size());
        assertEquals(3, status.get(0).size());
        // Colours as the second word stay one family
        var plain = ProductGroupingSuggester.clusters(List.of(
                product("ЭМАЛЬ БЕЛАЯ"), product("ЭМАЛЬ ЧЕРНАЯ"), product("ЭМАЛЬ СИНЯЯ"), product("ЭМАЛЬ БЕЛАЯ")));
        assertEquals(1, plain.size());
        // Colour codes in the second word stay one family
        var spray = ProductGroupingSuggester.clusters(List.of(
                product("АЭРОЗОЛЬ 3004 БОРДОВЫЙ"), product("АЭРОЗОЛЬ 1015 КРЕМОВЫЙ"), product("АЭРОЗОЛЬ 9005 ЧЕРНЫЙ")));
        assertEquals(1, spray.size());
        assertEquals(3, spray.get(0).size());
    }
}
