package kz.korkem.invoice.security;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.config.BeanDefinition;
import org.springframework.context.annotation.ClassPathScanningCandidateComponentProvider;
import org.springframework.core.annotation.AnnotatedElementUtils;
import org.springframework.core.type.filter.AnnotationTypeFilter;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.RestController;

/** Admin rules live on the endpoints (@AdminOnly), so check that none was forgotten. */
class ControllerSecurityTest {

    @Test
    void everyDeleteEndpointIsAdminOnly() throws Exception {
        List<String> open = new ArrayList<>();
        for (Class<?> controller : controllers()) {
            for (Method m : controller.getDeclaredMethods()) {
                if (m.isAnnotationPresent(DeleteMapping.class) && !adminOnly(controller, m)) {
                    open.add(controller.getSimpleName() + "." + m.getName());
                }
            }
        }
        assertEquals(List.of(), open, "DELETE endpoints without @AdminOnly");
    }

    @Test
    void adminActionsStayAdminOnly() throws Exception {
        assertTrue(adminOnly(kz.korkem.invoice.controller.UserController.class, "list"));
        assertTrue(adminOnly(kz.korkem.invoice.controller.SettingsController.class, "updateCompany"));
        assertTrue(adminOnly(kz.korkem.invoice.controller.ClientMergeController.class, "merge"));
        assertTrue(adminOnly(kz.korkem.invoice.controller.ProductGroupingController.class, "group"));
    }

    private static boolean adminOnly(Class<?> controller, String method) {
        for (Method m : controller.getDeclaredMethods()) {
            if (m.getName().equals(method)) return adminOnly(controller, m);
        }
        throw new AssertionError(controller.getSimpleName() + "." + method + " not found");
    }

    private static boolean adminOnly(Class<?> controller, Method m) {
        PreAuthorize rule = AnnotatedElementUtils.findMergedAnnotation(m, PreAuthorize.class);
        if (rule == null) rule = AnnotatedElementUtils.findMergedAnnotation(controller, PreAuthorize.class);
        return rule != null && rule.value().equals("hasRole('ADMIN')");
    }

    private static List<Class<?>> controllers() throws ClassNotFoundException {
        var scanner = new ClassPathScanningCandidateComponentProvider(false);
        scanner.addIncludeFilter(new AnnotationTypeFilter(RestController.class));
        List<Class<?>> out = new ArrayList<>();
        for (BeanDefinition d : scanner.findCandidateComponents("kz.korkem.invoice.controller")) {
            out.add(Class.forName(d.getBeanClassName()));
        }
        assertTrue(out.size() > 5, "controllers not found");
        return out;
    }
}
