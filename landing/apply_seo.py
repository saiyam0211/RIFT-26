#!/usr/bin/env python3
"""
SEO Enhancement Script for RIFT '26 Website
Automatically applies SEO, GEO, and social media meta tags to all HTML pages.
"""

import os
import re
import json
import shutil
from pathlib import Path
from typing import Dict, Optional

# Configuration
DOMAIN = "https://rift.pwioi.club"
INSTAGRAM_USERNAME = "rift.pwioi"
INSTAGRAM_URL = "https://instagram.com/rift.pwioi"
UNSTOP_REGISTRATION_URL = "https://unstop.com/hackathons/rift-26-hackathon-physics-wallah-institute-of-innovation-1603718"
SUPPORT_EMAIL = "rift_support@pwioi.com"
SITE_NAME = "RIFT '26"
OG_IMAGE = "/images/OG_image.png"

# Page-specific SEO configurations
PAGE_CONFIGS = {
    "index.html": {
        "title": "RIFT '26 - Pan India 24-Hour Open Innovation Hackathon | Register Now",
        "description": "Join RIFT, the ultimate 24-hour Open Innovation hackathon by PW IOI. Compete live in Bengaluru, Pune, Noida, & Lucknow on Feb 19-20, 2026. 2000+ Devs. Big Prizes. Register on Unstop. Make a Shift.",
        "canonical": "/",
        "og_title": "RIFT '26 - Pan India 24-Hour Open Innovation Hackathon",
        "og_description": "Join RIFT, the ultimate 24-hour Open Innovation hackathon by PW IOI. Compete live in Bengaluru, Pune, Noida, & Lucknow on Feb 19-20, 2026. 2000+ Devs. Big Prizes. Make a Shift.",
        "has_structured_data": True
    },
    "agenda/page.html": {
        "title": "Agenda - RIFT '26 Pan India Hackathon",
        "description": "Detailed agenda for RIFT '26, the 24-hour Open Innovation hackathon by PW IOI. Explore schedules for Bengaluru, Pune, Noida, & Lucknow on Feb 19-20, 2026.",
        "canonical": "/agenda",
        "og_title": "Agenda - RIFT '26 Pan India Hackathon",
        "og_description": "Detailed agenda for RIFT '26, the 24-hour Open Innovation hackathon by PW IOI. Explore schedules for Bengaluru, Pune, Noida, & Lucknow on Feb 19-20, 2026."
    },
    "speakers/page.html": {
        "title": "Speakers - RIFT '26 Pan India Hackathon",
        "description": "Meet the inspiring speakers at RIFT '26, the 24-hour Open Innovation hackathon by PW IOI. Learn from industry leaders and experts.",
        "canonical": "/speakers",
        "og_title": "Speakers - RIFT '26 Pan India Hackathon",
        "og_description": "Meet the inspiring speakers at RIFT '26, the 24-hour Open Innovation hackathon by PW IOI. Learn from industry leaders and experts."
    },
    "contact/page.html": {
        "title": "Contact Us - RIFT '26 Pan India Hackathon",
        "description": "Get in touch with the RIFT '26 team. Contact us for queries regarding the 24-hour Open Innovation hackathon by PW IOI in Bengaluru, Pune, Noida, & Lucknow on Feb 19-20, 2026.",
        "canonical": "/contact",
        "og_title": "Contact Us - RIFT '26 Pan India Hackathon",
        "og_description": "Get in touch with the RIFT '26 team. Contact us for queries regarding the 24-hour Open Innovation hackathon by PW IOI in Bengaluru, Pune, Noida, & Lucknow on Feb 19-20, 2026."
    },
    "venue/page.html": {
        "title": "Venue - RIFT '26 Pan India Hackathon",
        "description": "Discover the venues for RIFT '26, the 24-hour Open Innovation hackathon by PW IOI. Find locations in Bengaluru, Pune, Noida, & Lucknow on Feb 19-20, 2026.",
        "canonical": "/venue",
        "og_title": "Venue - RIFT '26 Pan India Hackathon",
        "og_description": "Discover the venues for RIFT '26, the 24-hour Open Innovation hackathon by PW IOI. Find locations in Bengaluru, Pune, Noida, & Lucknow on Feb 19-20, 2026."
    },
    "terms-and-conditions/page.html": {
        "title": "Terms and Conditions - RIFT '26 Pan India Hackathon",
        "description": "Read the terms and conditions for RIFT '26, the 24-hour Open Innovation hackathon by PW IOI. Understand the rules and guidelines for participation.",
        "canonical": "/terms-and-conditions",
        "og_title": "Terms and Conditions - RIFT '26 Pan India Hackathon",
        "og_description": "Read the terms and conditions for RIFT '26, the 24-hour Open Innovation hackathon by PW IOI. Understand the rules and guidelines for participation."
    }
}

# Structured Data JSON-LD for main page
STRUCTURED_DATA = {
    "@context": "https://schema.org",
    "@type": "Event",
    "name": "RIFT '26 - Pan India 24-Hour Open Innovation Hackathon",
    "description": "Join RIFT, the ultimate 24-hour Open Innovation hackathon by PW IOI. Compete live in Bengaluru, Pune, Noida, & Lucknow on Feb 19-20, 2026. 2000+ Devs. Big Prizes. Make a Shift.",
    "startDate": "2026-02-19T09:00:00+05:30",
    "endDate": "2026-02-20T09:00:00+05:30",
    "eventStatus": "https://schema.org/EventScheduled",
    "eventAttendanceMode": "https://schema.org/OfflineEventAttendanceMode",
    "location": [
        {
            "@type": "Place",
            "name": "Bengaluru",
            "address": {
                "@type": "PostalAddress",
                "addressLocality": "Bengaluru",
                "addressRegion": "KA",
                "addressCountry": "IN"
            }
        },
        {
            "@type": "Place",
            "name": "Pune",
            "address": {
                "@type": "PostalAddress",
                "addressLocality": "Pune",
                "addressRegion": "MH",
                "addressCountry": "IN"
            }
        },
        {
            "@type": "Place",
            "name": "Noida",
            "address": {
                "@type": "PostalAddress",
                "addressLocality": "Noida",
                "addressRegion": "UP",
                "addressCountry": "IN"
            }
        },
        {
            "@type": "Place",
            "name": "Lucknow",
            "address": {
                "@type": "PostalAddress",
                "addressLocality": "Lucknow",
                "addressRegion": "UP",
                "addressCountry": "IN"
            }
        }
    ],
    "image": OG_IMAGE,
    "organizer": {
        "@type": "Organization",
        "name": "PW IOI",
        "url": DOMAIN,
        "email": SUPPORT_EMAIL,
        "sameAs": [
            INSTAGRAM_URL,
            UNSTOP_REGISTRATION_URL
        ]
    },
    "url": DOMAIN,
    "offers": {
        "@type": "Offer",
        "url": UNSTOP_REGISTRATION_URL,
        "price": "0",
        "priceCurrency": "INR",
        "availability": "https://schema.org/InStock",
        "validFrom": "2025-12-01T00:00:00+05:30"
    },
    "performer": {
        "@type": "Organization",
        "name": "PW IOI"
    }
}


def escape_html(text: str) -> str:
    """Escape HTML entities in text for use in HTML attributes."""
    # Escape & first, then quotes (since we use double quotes for attributes)
    return text.replace("&", "&amp;").replace('"', "&quot;")


def get_or_create_meta_tag(content: str, name: str = None, property: str = None) -> str:
    """Generate a meta tag."""
    if property:
        return f'    <meta property="{property}" content="{escape_html(content)}">\n'
    elif name:
        return f'    <meta name="{name}" content="{escape_html(content)}">\n'
    return ""


def get_or_create_link_tag(href: str, rel: str) -> str:
    """Generate a link tag."""
    return f'    <link rel="{rel}" href="{escape_html(href)}">\n'


def find_insert_position(head_content: str) -> int:
    """Find the best position to insert SEO tags (after viewport/generator, before closing head or style tags)."""
    # Try to find after generator meta tag
    generator_match = re.search(r'(<meta name="generator"[^>]*>)', head_content, re.IGNORECASE)
    if generator_match:
        return generator_match.end()
    
    # Try to find after viewport
    viewport_match = re.search(r'(<meta name="viewport"[^>]*>)', head_content, re.IGNORECASE)
    if viewport_match:
        return viewport_match.end()
    
    # Fallback: after charset
    charset_match = re.search(r'(<meta charset="[^"]*">)', head_content, re.IGNORECASE)
    if charset_match:
        return charset_match.end()
    
    # Last resort: after opening head tag
    head_match = re.search(r'(<head[^>]*>)', head_content, re.IGNORECASE)
    if head_match:
        return head_match.end()
    
    return 0


def remove_existing_seo_tags(content: str) -> str:
    """Remove existing SEO-related meta tags to avoid duplicates."""
    # Patterns to remove
    patterns = [
        r'<meta\s+name="robots"[^>]*>',
        r'<meta\s+name="geo\.[^"]*"[^>]*>',
        r'<meta\s+name="ICBM"[^>]*>',
        r'<link\s+rel="canonical"[^>]*>',
        r'<meta\s+property="og:[^"]*"[^>]*>',
        r'<meta\s+name="twitter:[^"]*"[^>]*>',
        r'<script\s+type="application/ld\+json">.*?</script>',
    ]
    
    for pattern in patterns:
        content = re.sub(pattern, '', content, flags=re.IGNORECASE | re.DOTALL)
    
    # Also remove title and description if they're generic
    content = re.sub(r'<title>RIFT \'26</title>', '', content, flags=re.IGNORECASE)
    content = re.sub(r'<meta\s+name="description"\s+content="Join RIFT, the ultimate 24-hour[^"]*"[^>]*>', '', content, flags=re.IGNORECASE)
    
    return content


def add_seo_tags(content: str, config: Dict, file_path: str) -> str:
    """Add SEO tags to HTML content."""
    # Remove existing SEO tags
    content = remove_existing_seo_tags(content)
    
    # Find insertion point
    insert_pos = find_insert_position(content)
    
    # Build SEO tags
    seo_tags = []
    
    # Title
    title_match = re.search(r'<title>.*?</title>', content, re.IGNORECASE | re.DOTALL)
    if title_match:
        content = content[:title_match.start()] + f'    <title>{escape_html(config["title"])}</title>\n' + content[title_match.end():]
    else:
        seo_tags.append(f'    <title>{escape_html(config["title"])}</title>\n')
    
    # Description
    seo_tags.append(get_or_create_meta_tag(config["description"], name="description"))
    
    # Robots
    seo_tags.append(get_or_create_meta_tag("index, follow", name="robots"))
    
    # Canonical
    seo_tags.append(get_or_create_link_tag(f"{DOMAIN}{config['canonical']}", "canonical"))
    
    # GEO tags (only for main page)
    if file_path == "index.html":
        seo_tags.append(get_or_create_meta_tag("IN-KA", name="geo.region"))
        seo_tags.append(get_or_create_meta_tag("Bengaluru, Pune, Noida, Lucknow", name="geo.placename"))
        seo_tags.append(get_or_create_meta_tag("12.9716;77.5946", name="geo.position"))
        seo_tags.append(get_or_create_meta_tag("12.9716, 77.5946", name="ICBM"))
    
    # Open Graph
    seo_tags.append(get_or_create_meta_tag("website", property="og:type"))
    seo_tags.append(get_or_create_meta_tag(config["og_title"], property="og:title"))
    seo_tags.append(get_or_create_meta_tag(config["og_description"], property="og:description"))
    seo_tags.append(get_or_create_meta_tag(OG_IMAGE, property="og:image"))
    seo_tags.append(get_or_create_meta_tag(f"{DOMAIN}{config['canonical']}", property="og:url"))
    seo_tags.append(get_or_create_meta_tag(SITE_NAME, property="og:site_name"))
    seo_tags.append(get_or_create_meta_tag("en_IN", property="og:locale"))
    
    # Twitter Card
    seo_tags.append(get_or_create_meta_tag("summary_large_image", name="twitter:card"))
    seo_tags.append(get_or_create_meta_tag(config["og_title"], name="twitter:title"))
    seo_tags.append(get_or_create_meta_tag(config["og_description"], name="twitter:description"))
    seo_tags.append(get_or_create_meta_tag(OG_IMAGE, name="twitter:image"))
    seo_tags.append(get_or_create_meta_tag(f"@{INSTAGRAM_USERNAME}", name="twitter:site"))
    seo_tags.append(get_or_create_meta_tag(f"@{INSTAGRAM_USERNAME}", name="twitter:creator"))
    
    # Additional meta tags
    seo_tags.append(get_or_create_meta_tag("hackathon, innovation, coding, PW IOI, RIFT, tech event, Bengaluru, Pune, Noida, Lucknow", name="keywords"))
    seo_tags.append(get_or_create_meta_tag("PW IOI", name="author"))
    
    # Structured Data (only for main page)
    if config.get("has_structured_data"):
        structured_json = json.dumps(STRUCTURED_DATA, indent=2)
        seo_tags.append(f'    <script type="application/ld+json">\n{structured_json}\n    </script>\n')
    
    # Insert SEO tags
    seo_block = "".join(seo_tags)
    content = content[:insert_pos] + "\n" + seo_block + content[insert_pos:]
    
    return content


def process_file(file_path: Path, base_dir: Path) -> bool:
    """Process a single HTML file."""
    relative_path = str(file_path.relative_to(base_dir))
    
    # Check if we have config for this file
    if relative_path not in PAGE_CONFIGS:
        print(f"⚠️  Skipping {relative_path} (no configuration found)")
        return False
    
    config = PAGE_CONFIGS[relative_path]
    
    try:
        # Read file
        with open(file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # Add SEO tags
        content = add_seo_tags(content, config, relative_path)
        
        # Write back
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        
        print(f"✅ Processed: {relative_path}")
        return True
    
    except Exception as e:
        print(f"❌ Error processing {relative_path}: {e}")
        return False


def rename_page_to_index(base_dir: Path) -> bool:
    """Rename page.html to index.html if it exists."""
    page_html = base_dir / "page.html"
    index_html = base_dir / "index.html"
    
    if page_html.exists() and not index_html.exists():
        page_html.rename(index_html)
        print("✅ Renamed page.html to index.html")
        return True
    elif page_html.exists() and index_html.exists():
        print("⚠️  Both page.html and index.html exist. Keeping index.html, removing page.html")
        page_html.unlink()
        return True
    else:
        print("ℹ️  page.html not found (already renamed or doesn't exist)")
        return False


def create_index_in_subdirectories(base_dir: Path) -> int:
    """Create index.html files in subdirectories from page.html files."""
    created = 0
    
    # Find all subdirectories with page.html files
    for subdir in base_dir.iterdir():
        if subdir.is_dir() and not subdir.name.startswith('.'):
            page_html = subdir / "page.html"
            index_html = subdir / "index.html"
            
            if page_html.exists() and not index_html.exists():
                # Copy page.html to index.html
                shutil.copy2(page_html, index_html)
                print(f"✅ Created {index_html.relative_to(base_dir)}")
                created += 1
    
    return created


def main():
    """Main function."""
    print("🚀 Starting SEO Enhancement Script for RIFT '26\n")
    
    # Get base directory (where script is located)
    base_dir = Path(__file__).parent.absolute()
    print(f"📁 Working directory: {base_dir}\n")
    
    # Step 1: Rename page.html to index.html in root
    print("Step 1: Renaming page.html to index.html in root...")
    rename_page_to_index(base_dir)
    print()
    
    # Step 1.5: Create index.html files in subdirectories
    print("Step 1.5: Creating index.html files in subdirectories...")
    created = create_index_in_subdirectories(base_dir)
    if created > 0:
        print(f"✅ Created {created} index.html file(s) in subdirectories\n")
    else:
        print("ℹ️  No subdirectories needed index.html files\n")
    
    # Step 2: Find and process all HTML files
    print("Step 2: Processing HTML files...\n")
    
    processed = 0
    skipped = 0
    
    # Process files in order of priority
    for relative_path in PAGE_CONFIGS.keys():
        file_path = base_dir / relative_path
        if file_path.exists():
            if process_file(file_path, base_dir):
                processed += 1
            else:
                skipped += 1
        else:
            print(f"⚠️  File not found: {relative_path}")
            skipped += 1
    
    print(f"\n✨ Done! Processed {processed} file(s), skipped {skipped} file(s)")
    print("\n📝 SEO enhancements applied:")
    print("   • Meta tags (title, description, robots, keywords)")
    print("   • Canonical URLs")
    print("   • GEO targeting (main page)")
    print("   • Open Graph tags")
    print("   • Twitter Card tags")
    print("   • Structured Data JSON-LD (main page)")
    print("   • Social media tags (@rift.pwioi)")
    print(f"\n🔗 External Links:")
    print(f"   • Registration: {UNSTOP_REGISTRATION_URL}")
    print(f"   • Instagram: {INSTAGRAM_URL}")
    print(f"   • Support: {SUPPORT_EMAIL}")


if __name__ == "__main__":
    main()

