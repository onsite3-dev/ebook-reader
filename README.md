# eBook Reader v1.0

A lightweight web-based ebook reader with vertical/horizontal reading modes and paginated display.

## Features

- **Multiple Reading Modes**
  - Horizontal (left-to-right)
  - Vertical (traditional Chinese right-to-left)
  
- **Paginated Reading**
  - Fixed viewport, no scrolling
  - Smart pagination based on screen size
  - Smooth page-turn animation

- **Navigation**
  - Keyboard shortcuts (arrow keys)
  - On-screen buttons (auto-hide in vertical mode)
  - Jump to first/last page
  - Jump to specific page number

- **Customization**
  - Font size: 12-48px
  - Reading direction remembered
  - Responsive to screen size

- **File Support**
  - TXT files
  - Direct iCloud Drive file access (via browser file picker)

## Usage

1. Open `public/index.html` in a browser
2. Click "Open File" and select a TXT file
3. Use arrow keys or on-screen buttons to navigate
4. Toggle between vertical/horizontal reading
5. Adjust font size as needed

## Technical Stack

- Pure HTML/CSS/JavaScript (no build required)
- Tailwind CSS (via CDN)
- localStorage for preferences

## Version History

### v1.0 (2026-05-10)
- Initial release
- Core reading functionality
- Vertical/horizontal modes
- Paginated display
- Navigation controls
