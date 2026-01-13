# Mountaineers Assistant Privacy Policy

## TL;DR

- Your data **stays on your device**. Nothing is sent anywhere.
- We only read your Mountaineers.org activity pages (stuff **you can already see**).
- **No accounts, no tracking, no analytics, no third parties.**
- Error reporting is **optional** and you see exactly what gets shared before submitting.

---

Mountaineers Assistant is a Chrome extension that helps members review their Mountaineers.org activity history without leaving the site. This privacy policy explains what information the extension accesses, how that information is handled, and the choices available to you.

## Data We Access

- **Mountaineers.org content you can already see.** When you request a refresh, the extension uses your existing Mountaineers.org session to retrieve your activity history, roster pages, and related metadata directly from `https://www.mountaineers.org/`.
- **Extension preferences.** The preferences screen lets you toggle caching behavior and other UI settings that personalize your experience.

The extension does **not** collect credentials, payment details, or content from any other website.

## How We Use Your Data

- **Generate on-page insights.** Retrieved activity data is processed locally to display counts, trends, and filters in the insights dashboard.
- **Cache recent results.** Activity data is stored in `chrome.storage.local` so future visits load quickly without refetching from Mountaineers.org unless you request a refresh.
- **Remember your settings.** Preference toggles are saved locally so the extension remembers your choices.

## Where Your Data Lives

All activity data and preferences remain on your device in Chrome’s `chrome.storage.local` area. The extension is fully packaged; it does not run remote code and it does not send any data to external servers, analytics platforms, or third parties.

## Required Browser Permissions

- `storage`: Needed to keep a local cache of your activity history and your preferences.
- `offscreen`: Allows the extension to run data collection in a background document context to fetch your activity data from Mountaineers.org while keeping the main extension responsive.
- `tabs`: Used only to confirm that the active tab is on Mountaineers.org before running a refresh and to open extension pages (such as the insights dashboard) in new tabs at your request.
- `https://www.mountaineers.org/*`: Grants access to Mountaineers.org pages so the extension can fetch your activity data while you are signed in.

These permissions are scoped solely to support the features described above.

## Error Reporting (Optional)

When errors occur in the extension, you may choose to report them to help us improve the extension.

**What we collect when you report an error:**
- Error messages and technical details (stack traces)
- Extension version, browser version, and operating system
- Context about what operation was being performed
- Sanitized diagnostic data (counts, timings, error types)

**What we DO NOT collect:**
- Activity titles or descriptions
- Person names or member identifiers
- Any personally identifiable information from your Mountaineers.org data

**How it works:**
- When an error occurs, you'll see a notification
- You can choose to report the error or dismiss the notification
- Before submitting, you'll see a preview of exactly what data will be included
- Reports are submitted as public GitHub issues (you can add additional context)
- Error data is stored locally for 7 days to allow later reporting

**Your control:**
- Reporting is always optional and requires your explicit action
- You can review all diagnostic data before submitting
- You can view or clear error logs from the Preferences page
- Dismissing an error notification prevents it from appearing again

## Your Choices and Controls

- **Clear the cache:** Use the preferences page to clear saved activity data at any time.
- **Clear error logs:** Use the preferences page to clear error logs at any time.
- **Remove the extension:** Uninstalling Mountaineers Assistant from Chrome deletes all data stored by the extension.

The extension only runs when you open the preferences or insights screen, or when you request a data refresh.

## Changes to This Policy

We may update this policy as the extension evolves. Significant changes will be noted in the [project README](https://github.com/dreamiurg/mountaineers-assistant#readme) or release notes.

## Contact

Have questions about privacy or want to report an issue? [Open an issue](https://github.com/dreamiurg/mountaineers-assistant/issues) in the Mountaineers Assistant repository or contact the maintainers through the project's support channels.
