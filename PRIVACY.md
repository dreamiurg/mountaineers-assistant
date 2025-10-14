# Mountaineers Assistant Privacy Policy

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
- `scripting`: Allows the background service worker to inject the bundled `collect` script into Mountaineers.org pages when you ask for a refresh, so the script can make authenticated fetches within the page context.
- `tabs`: Used only to confirm that the active tab is on Mountaineers.org before running a refresh and to open extension pages (such as the insights dashboard) in new tabs at your request.
- `https://www.mountaineers.org/*`: Grants access to Mountaineers.org pages so the extension can fetch your activity data while you are signed in.

These permissions are scoped solely to support the features described above.

## Your Choices and Controls

- **Clear the cache:** Use the preferences page to clear saved activity data at any time.
- **Remove the extension:** Uninstalling Mountaineers Assistant from Chrome deletes all data stored by the extension.

The extension only runs when you open the preferences or insights screen, or when you request a data refresh.

## Changes to This Policy

We may update this policy as the extension evolves. Significant changes will be noted in the project README or release notes.

## Contact

Have questions about privacy or want to report an issue? Open an issue in the Mountaineers Assistant repository or contact the maintainers through the project’s support channels.
