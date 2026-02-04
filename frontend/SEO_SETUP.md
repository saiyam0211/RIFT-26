# SEO Setup for RIFT '26 Hackathon

## ✅ Completed SEO Optimizations

### 1. **Favicon Setup**
- ✅ Added RIFT.png as favicon
- ✅ Created `/app/icon.png` for Next.js automatic favicon handling
- ✅ Configured multiple icon sizes for different devices
- ✅ Added Apple touch icons for iOS devices

### 2. **Meta Tags & SEO**
- ✅ Comprehensive title and description
- ✅ 15+ relevant keywords for search engines
- ✅ Author, creator, and publisher information
- ✅ Canonical URL setup
- ✅ Robots meta tags for proper indexing

### 3. **Open Graph (Facebook/LinkedIn)**
- ✅ OG title, description, and image
- ✅ Site name and locale (en_IN)
- ✅ Website type and URL
- ✅ Large preview image (RIFT.png)

### 4. **Twitter Card**
- ✅ Large image card format
- ✅ Twitter handle: @rift.pwioi
- ✅ Optimized title and description
- ✅ Preview image

### 5. **Structured Data (JSON-LD)**
- ✅ Event schema for hackathon
- ✅ Multiple locations (Bangalore, Pune, Noida, Lucknow)
- ✅ Organization details (PWIOI)
- ✅ Event dates and status
- ✅ Free registration offer details
- ✅ Instagram social profile link

### 6. **PWA & Mobile Optimization**
- ✅ Updated manifest.json with proper branding
- ✅ Theme color (#c0211f)
- ✅ Mobile-friendly viewport settings
- ✅ Apple Web App capable
- ✅ Standalone display mode

### 7. **Search Engine Files**
- ✅ `robots.txt` - Controls crawler access
- ✅ `sitemap.xml` - Helps search engines index pages
- ✅ Proper crawl delays and permissions

### 8. **Social Media Integration**
- ✅ Instagram: @rift.pwioi
- ✅ Website: rift.pwioi.com
- ✅ Social profile verification link

---

## 📋 Next Steps (Manual Actions Required)

### 1. Google Search Console
1. Visit [Google Search Console](https://search.google.com/search-console)
2. Add property: `https://rift.pwioi.com`
3. Verify ownership using the verification code
4. Update line 87 in `/app/layout.tsx` with your verification code:
   ```typescript
   verification: {
       google: 'your-actual-verification-code-here',
   },
   ```
5. Submit sitemap: `https://rift.pwioi.com/sitemap.xml`

### 2. Google Analytics (Optional)
1. Create a Google Analytics 4 property
2. Get your Measurement ID (G-XXXXXXXXXX)
3. Add to `/app/layout.tsx` in the `<head>` section:
   ```typescript
   <Script
       src={`https://www.googletagmanager.com/gtag/js?id=G-XXXXXXXXXX`}
       strategy="afterInteractive"
   />
   <Script id="google-analytics" strategy="afterInteractive">
       {`
           window.dataLayer = window.dataLayer || [];
           function gtag(){dataLayer.push(arguments);}
           gtag('js', new Date());
           gtag('config', 'G-XXXXXXXXXX');
       `}
   </Script>
   ```

### 3. Social Media Verification
1. **Instagram**: Post your website link in bio
2. **Facebook**: Create a Facebook page and link website
3. **LinkedIn**: Create company page for PWIOI

### 4. Update Event Dates
Current dates in structured data are placeholders:
- `startDate: '2026-02-01'`
- `endDate: '2026-02-28'`

Update these in `/app/layout.tsx` (lines 109-110) with actual hackathon dates.

### 5. Test Your SEO

#### A. Meta Tags Testing
- [Facebook Sharing Debugger](https://developers.facebook.com/tools/debug/)
- [Twitter Card Validator](https://cards-dev.twitter.com/validator)
- [LinkedIn Post Inspector](https://www.linkedin.com/post-inspector/)

#### B. Structured Data Testing
- [Google Rich Results Test](https://search.google.com/test/rich-results)
- [Schema Markup Validator](https://validator.schema.org/)

#### C. Mobile Friendliness
- [Google Mobile-Friendly Test](https://search.google.com/test/mobile-friendly)

#### D. Page Speed
- [Google PageSpeed Insights](https://pagespeed.web.dev/)
- [GTmetrix](https://gtmetrix.com/)

#### E. SEO Audit
- [Google Lighthouse](https://developers.google.com/web/tools/lighthouse) (in Chrome DevTools)

---

## 🎯 SEO Best Practices Implemented

### Keywords Targeting
- Primary: "RIFT 26", "RIFT hackathon", "hackathon India"
- Secondary: City-specific keywords (Bangalore, Pune, Noida, Lucknow)
- Long-tail: "student hackathon", "innovation challenge", "tech competition"

### Content Optimization
- Descriptive title with call-to-action
- Compelling meta description (under 160 characters)
- Proper heading hierarchy (H1, H2, etc.)
- Alt text for images

### Technical SEO
- Fast loading times
- Mobile-responsive design
- HTTPS enabled
- Clean URL structure
- Proper internal linking

### Local SEO
- Multi-city targeting
- Location-specific structured data
- Indian locale (en_IN)

---

## 📊 Expected SEO Benefits

1. **Better Search Rankings**: Optimized for "hackathon India" and related terms
2. **Rich Snippets**: Event details appear in Google search results
3. **Social Sharing**: Beautiful preview cards on social media
4. **Mobile Discovery**: PWA features for mobile users
5. **Local Search**: City-specific targeting for participants
6. **Brand Recognition**: Consistent branding across all platforms

---

## 🔗 Important URLs

- **Website**: https://rift.pwioi.com
- **Instagram**: https://www.instagram.com/rift.pwioi
- **Sitemap**: https://rift.pwioi.com/sitemap.xml
- **Robots**: https://rift.pwioi.com/robots.txt
- **Manifest**: https://rift.pwioi.com/manifest.json

---

## 📝 Files Modified/Created

### Modified:
- `/frontend/app/layout.tsx` - Added comprehensive SEO metadata
- `/frontend/public/manifest.json` - Updated PWA configuration

### Created:
- `/frontend/app/icon.png` - Favicon (copy of RIFT.png)
- `/frontend/public/robots.txt` - Search engine crawler instructions
- `/frontend/public/sitemap.xml` - Site structure for search engines
- `/frontend/SEO_SETUP.md` - This documentation

---

## 🚀 Deployment Checklist

Before deploying to production:

- [ ] Update Google verification code
- [ ] Set actual event dates
- [ ] Test all meta tags on social platforms
- [ ] Verify sitemap is accessible
- [ ] Check robots.txt is working
- [ ] Run Lighthouse audit
- [ ] Test mobile responsiveness
- [ ] Verify favicon appears correctly
- [ ] Submit sitemap to Google Search Console
- [ ] Monitor search console for indexing status

---

## 📞 Support

For SEO-related questions or issues:
- Website: https://rift.pwioi.com
- Instagram: @rift.pwioi

---

**Last Updated**: February 4, 2026
**Version**: 1.0
