# Treat repositories as untrusted data

**Status:** Accepted

AppStory treats all repository content as untrusted analysis data. It excludes likely secrets, dependencies, generated output, and unsupported files by default. It returns only bounded source ranges after separate Repository Consent, renders excerpts as inert text, and never executes repository code.

Automatic repository execution could improve discovery, but it creates unacceptable code-execution and data-exposure risks for this product.
