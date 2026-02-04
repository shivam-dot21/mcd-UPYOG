package org.egov.user.web.controller;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import lombok.extern.slf4j.Slf4j;

import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpSession;

import java.util.HashMap;
import java.util.Map;
import java.util.Random;

@Slf4j
@RestController
@RequestMapping("/api")
public class CaptchaController {

	@GetMapping("/captcha")
    public Map<String, String> generateCaptcha(HttpServletRequest request) {

        // Generate random captcha
        String captchaText = generateRandomText(6);

        // Store in session (server side)
        HttpSession session = request.getSession(true);
        session.setAttribute("CAPTCHA_VALUE", captchaText);
        session.setMaxInactiveInterval(120); // 2 minutes expiry

        log.info("Captcha generated (for debug only): {}", captchaText);

        // Send as JSON response
        Map<String, String> response = new HashMap<>();
        response.put("captcha", captchaText);

        return response;
    }

    private String generateRandomText(int length) {

        String chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
        Random random = new Random();

        StringBuilder sb = new StringBuilder();

        for (int i = 0; i < length; i++) {
            sb.append(chars.charAt(random.nextInt(chars.length())));
        }

        return sb.toString();
    }

}
