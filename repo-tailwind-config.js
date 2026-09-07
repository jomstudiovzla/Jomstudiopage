        tailwind.config = {
            darkMode: "class",
            theme: {
                extend: {
                    "colors": {
                        "primary": "var(--theme-primary)",
                        "primary-fixed": "var(--theme-primary)",
                        "primary-container": "var(--theme-primary-alpha)",
                        "on-primary-container": "var(--color-bg)",
                        "secondary": "var(--color-text)",
                        "on-surface": "var(--color-text)",
                        "on-surface-variant": "var(--color-text-variant)",
                        "outline": "var(--color-outline)",
                        "outline-variant": "var(--color-outline-variant)",
                        "surface": "var(--color-surface)",
                        "surface-container-lowest": "var(--color-surface-lowest)",
                        "surface-container-low": "var(--color-surface-low)",
                        "surface-container": "var(--color-surface-container)",
                        "surface-container-high": "var(--color-surface-high)",
                        "surface-container-highest": "var(--color-surface-highest)",
                        "accent": "var(--theme-primary)"
                    },
                    "borderRadius": {
                        "DEFAULT": "0px",
                        "lg": "4px",
                        "xl": "8px",
                        "full": "9999px"
                    },
                    "spacing": {
                        "stack-sm": "16px",
                        "gutter": "32px",
                        "base": "8px",
                        "stack-md": "32px",
                        "container-max": "1440px",
                        "margin-desktop": "80px",
                        "margin-mobile": "24px",
                        "stack-lg": "64px"
                    },
                    "fontFamily": {
                        "body-md": ["Sora"],
                        "label-mono": ["JetBrains Mono"],
                        "label-code": ["JetBrains Mono"],
                        "headline-lg-mobile": ["Sora"],
                        "body-lg": ["Sora"],
                        "headline-lg": ["Sora"],
                        "headline-md": ["Sora"],
                        "display-lg": ["Sora"],
                        "label-caps": ["Sora"]
                    },
                    "fontSize": {
                        "body-md": ["16px", {"lineHeight": "1.6", "fontWeight": "400"}],
                        "label-mono": ["11px", {"lineHeight": "1.5", "letterSpacing": "0.15em", "fontWeight": "500"}],
                        "label-code": ["11px", {"lineHeight": "1.5", "letterSpacing": "0.15em", "fontWeight": "500"}],
                        "headline-lg-mobile": ["36px", {"lineHeight": "1.1", "fontWeight": "700"}],
                        "body-lg": ["18px", {"lineHeight": "1.6", "fontWeight": "300"}],
                        "headline-lg": ["56px", {"lineHeight": "1.1", "letterSpacing": "-0.03em", "fontWeight": "800"}],
                        "headline-md": ["28px", {"lineHeight": "1.3", "fontWeight": "600"}],
                        "display-lg": ["84px", {"lineHeight": "0.95", "letterSpacing": "-0.05em", "fontWeight": "900"}],
                        "label-caps": ["12px", {"lineHeight": "1", "letterSpacing": "0.1em", "fontWeight": "700"}]
                    }
                },
            },
        }
