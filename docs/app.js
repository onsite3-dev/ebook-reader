// IndexedDB for bookshelf storage
const DB_NAME = 'PPeReaderDB';
const DB_VERSION = 1;
const STORE_NAME = 'books';

let db = null;

async function initDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    
    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };
    
    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id', autoIncrement: true });
        store.createIndex('title', 'title', { unique: false });
        store.createIndex('addedAt', 'addedAt', { unique: false });
        store.createIndex('lastReadAt', 'lastReadAt', { unique: false });
      }
    };
  });
}

async function saveBookToShelf(title, content) {
  if (!db) await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    
    const book = {
      title,
      content,
      addedAt: Date.now(),
      lastReadAt: Date.now(),
      progress: 0,
      fontSize: 24,
      isVertical: true
    };
    
    const request = store.add(book);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getAllBooks() {
  if (!db) await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.getAll();
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function getBookById(id) {
  if (!db) await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readonly');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);
    
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function updateBookProgress(id, progress, pageIndex, fontSize, isVertical) {
  if (!db) await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(id);
    
    request.onsuccess = () => {
      const book = request.result;
      if (book) {
        book.progress = progress;
        book.currentPage = pageIndex;
        book.fontSize = fontSize;
        book.isVertical = isVertical;
        book.lastReadAt = Date.now();
        
        const updateRequest = store.put(book);
        updateRequest.onsuccess = () => resolve();
        updateRequest.onerror = () => reject(updateRequest.error);
      }
    };
    request.onerror = () => reject(request.error);
  });
}

async function deleteBook(id) {
  if (!db) await initDB();
  
  return new Promise((resolve, reject) => {
    const transaction = db.transaction([STORE_NAME], 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.delete(id);
    
    request.onsuccess = () => resolve();
    request.onerror = () => reject(request.error);
  });
}

// Initialize DB on load
initDB().catch(err => console.error('IndexedDB init failed:', err));
// Debug version - let's see what's actually happening

let currentBook = null;
let isVerticalMode = false;
let bookPages = [];
let currentPageIndex = 0;

const PROGRESS_KEY_PREFIX = 'ebook-progress-';
const READING_MODE_KEY = 'ebook-reading-mode';

const fileInput = document.getElementById('file-input');
const emptyState = document.getElementById('empty-state');
const readerContent = document.getElementById('reader-content');
const headerControls = document.getElementById('header-controls');
const bookTitle = document.getElementById('book-title');
const bookText = document.getElementById('book-text');
const fontSizeInput = document.getElementById('font-size');
const fontSizeValue = document.getElementById('font-size-value');
const closeBookButton = document.getElementById('close-book');
const toggleDirectionButton = document.getElementById('toggle-direction');
const prevPageButton = document.getElementById('prev-page');
const nextPageButton = document.getElementById('next-page');
const firstPageButton = document.getElementById('first-page');
const lastPageButton = document.getElementById('last-page');
const pageIndicator = document.getElementById('page-indicator');

fileInput.addEventListener('change', handleFileSelect);
fontSizeInput.addEventListener('input', handleFontSizeChange);
closeBookButton.addEventListener('click', closeBook);
toggleDirectionButton.addEventListener('click', toggleReadingDirection);
prevPageButton.addEventListener('click', () => changePage(-1));
nextPageButton.addEventListener('click', () => changePage(1));
firstPageButton.addEventListener('click', goToFirstPage);
lastPageButton.addEventListener('click', goToLastPage);
pageIndicator.addEventListener('click', promptJumpToPage);

document.addEventListener('keydown', (e) => {
  if (!currentBook) return;
  if (e.key === 'ArrowLeft') {
    e.preventDefault();
    changePage(isVerticalMode ? 1 : -1);
  } else if (e.key === 'ArrowRight') {
    e.preventDefault();
    changePage(isVerticalMode ? -1 : 1);
  } else if (e.key === 'ArrowUp' && !isVerticalMode) {
    e.preventDefault();
    changePage(-1);
  } else if (e.key === 'ArrowDown' && !isVerticalMode) {
    e.preventDefault();
    changePage(1);
  }
});

// EPUB helper functions
async function extractTextFromEpub(file) {
  try {
    const zip = await JSZip.loadAsync(file);
    let textContent = '';
    
    // Find all HTML/XHTML files in EPUB
    const contentFiles = [];
    zip.forEach((relativePath, zipEntry) => {
      if (relativePath.match(/\.(html|xhtml|xml)$/i) && !relativePath.includes('META-INF')) {
        contentFiles.push(relativePath);
      }
    });
    
    // Sort files (rough order)
    contentFiles.sort();
    
    // Extract text from each file
    for (const path of contentFiles) {
      const content = await zip.file(path).async('string');
      // Strip HTML tags and extract text
      const tempDiv = document.createElement('div');
      tempDiv.innerHTML = content;
      const text = tempDiv.textContent || tempDiv.innerText || '';
      textContent += text + '\n\n';
    }
    
    return textContent.trim();
  } catch (e) {
    console.error('EPUB extraction failed:', e);
    throw new Error('Failed to extract text from EPUB');
  }
}

function handleFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;
  
  const isEpub = file.name.toLowerCase().endsWith('.epub');
  const isTxt = file.name.toLowerCase().endsWith('.txt');
  
  if (!isEpub && !isTxt) {
    alert('Only TXT and EPUB files supported');
    return;
  }
  
  if (isEpub) {
    // Handle EPUB
    extractTextFromEpub(file)
      .then(text => displayBook(file.name, text))
      .catch(err => alert('Error reading EPUB: ' + err.message));
  } else {
    // Handle TXT
    const reader = new FileReader();
    reader.onload = (e) => displayBook(file.name, e.target.result);
    reader.onerror = () => alert('Error reading file');
    reader.readAsText(file);
  }
}
function displayBook(title, content) {
  currentBook = { title, content };
  bookTitle.textContent = title;
  
  const savedFontSize = 24;
  fontSizeInput.value = savedFontSize;
  applyFontSize(savedFontSize);
  
  isVerticalMode = loadReadingMode();
  applyReadingDirection();
  
  // Show UI first so container dimensions are correct
  emptyState.classList.add('hidden');
  readerContent.classList.remove('hidden');
  headerControls.classList.remove('hidden');
  
  // Small delay to ensure rendering is complete
  setTimeout(() => {
    paginateContent(content);
    currentPageIndex = 0;
    renderCurrentPage();
    
    // Debug: log dimensions
    console.log('Container clientHeight:', bookText.clientHeight);
    console.log('Container clientWidth:', bookText.clientWidth);
    console.log('Chars per page:', calculateCharsPerPage());
    console.log('Total pages:', bookPages.length);
    console.log('Content length:', content.length);
    
    // Debug: show on screen for iPad
    const debugInfo = `📊 Debug: ${content.length} 字 / ${bookPages.length} 頁 / 每頁 ${Math.floor(content.length / bookPages.length)} 字`;
    bookTitle.textContent = `${title} | ${debugInfo}`;
  }, 100);
}

function calculateCharsPerPage() {
  const fontSize = parseInt(fontSizeInput.value);
  const lineHeight = 1.8;
  
  // Get actual container dimensions
  const containerHeight = bookText.clientHeight || 600;
  const containerWidth = bookText.clientWidth || 800;
  
  console.log('Container:', containerHeight, 'x', containerWidth);
  
  if (isVerticalMode) {
    // Vertical mode: calculate safe chars, leaving bottom lines for safety
    const fontSize = parseInt(fontSizeInput.value);
    const containerHeight = bookText.clientHeight || 600;
    
    // Estimate chars per vertical line
    const charsPerLine = Math.floor((containerHeight * 0.85) / (fontSize * 1.3));
    
    // Base capacity: ~10 vertical lines worth
    const numLines = 10;
    const baseChars = charsPerLine * numLines;
    
    // Reserve 2 lines at bottom for mobile toolbar
    // Reserve lines based on device type
    const isMobile = /iPhone|Android/.test(navigator.userAgent);
    const reserveLines = isMobile ? 2.5 : 1.5;
    const safeChars = charsPerLine * (numLines - reserveLines);
    
    console.log('Vertical - chars/line:', charsPerLine, 'total lines:', numLines, 'reserve:', reserveLines, 'final:', safeChars);
    return Math.max(safeChars, 150);
    
  } else {
    // Horizontal mode - existing calculation works fine
    const usableHeight = Math.floor(containerHeight * 0.70);
    const usableWidth = Math.floor(containerWidth * 0.90);
    
    const lineHeightPx = fontSize * lineHeight;
    const numLines = Math.floor(usableHeight / (lineHeightPx * 1.2));
    const charsPerLine = Math.floor(usableWidth / (fontSize * 0.8));
    
    // Reserve 2 lines at bottom for mobile toolbar
    // Reserve lines based on device type
    const isMobile = /iPhone|Android/.test(navigator.userAgent);
    const reserveLines = isMobile ? 2.5 : 1.5;
    const displayLines = Math.max(numLines - reserveLines, 3);
    const total = Math.max(displayLines * charsPerLine, 50);
    
    console.log('Horizontal - lines:', numLines, 'display:', displayLines, 'reserve:', reserveLines, 'chars/line:', charsPerLine, 'total:', total);
    return total;
  }
}

function paginateContent(content) {
  bookPages = [];
  const charsPerPage = calculateCharsPerPage();
  
  // For both modes: overlap by 2 lines to ensure continuity
  let overlap = 0;
  if (isVerticalMode) {
    const fontSize = parseInt(fontSizeInput.value);
    const containerHeight = bookText.clientHeight || 600;
    const charsPerLine = Math.floor((containerHeight * 0.85) / (fontSize * 1.3));
    overlap = charsPerLine * 2; // Overlap 2 vertical lines
    console.log('Vertical overlap:', overlap, 'chars (2 lines)');
  } else {
    // Horizontal: overlap 2 lines
    const fontSize = parseInt(fontSizeInput.value);
    const lineHeight = 1.8;
    const containerWidth = bookText.clientWidth || 800;
    const charsPerLine = Math.floor((containerWidth * 0.90) / (fontSize * 0.8));
    overlap = charsPerLine * 2;
    console.log('Horizontal overlap:', overlap, 'chars (2 lines)');
  }
  
  console.log('Pagination - chars/page:', charsPerPage, 'overlap:', overlap);
  
  let i = 0;
  while (i < content.length) {
    const end = Math.min(i + charsPerPage, content.length);
    bookPages.push(content.substring(i, end));
    i += charsPerPage - overlap;
  }
  
  console.log('Total pages:', bookPages.length);
}

function renderCurrentPage() {
  if (bookPages.length === 0) return;
  
  bookText.classList.add('page-turning');
  setTimeout(() => {
    bookText.textContent = bookPages[currentPageIndex];
    setTimeout(() => bookText.classList.remove('page-turning'), 50);
    updatePageIndicator();
    updatePageButtons();
  }, 150);
}

function updatePageIndicator() {
  pageIndicator.textContent = `${currentPageIndex + 1} / ${bookPages.length}`;
}

function updatePageButtons() {
  const isFirst = currentPageIndex === 0;
  const isLast = currentPageIndex === bookPages.length - 1;
  prevPageButton.disabled = isFirst;
  nextPageButton.disabled = isLast;
  firstPageButton.disabled = isFirst;
  lastPageButton.disabled = isLast;
}

function changePage(direction) {
  const newIndex = currentPageIndex + direction;
  if (newIndex < 0 || newIndex >= bookPages.length) return;
  currentPageIndex = newIndex;
  renderCurrentPage();
  
  // Fade out navigation buttons after click
  document.querySelectorAll('.page-nav').forEach(nav => {
    nav.style.opacity = '0.15';
  });
}

function goToFirstPage() {
  if (currentPageIndex === 0) return;
  currentPageIndex = 0;
  renderCurrentPage();
  
  // Fade out navigation buttons
  document.querySelectorAll('.page-nav').forEach(nav => {
    nav.style.opacity = '0.15';
  });
}

function goToLastPage() {
  if (currentPageIndex === bookPages.length - 1) return;
  currentPageIndex = bookPages.length - 1;
  renderCurrentPage();
  
  // Fade out navigation buttons
  document.querySelectorAll('.page-nav').forEach(nav => {
    nav.style.opacity = '0.15';
  });
}

function promptJumpToPage() {
  const pageNum = prompt(`跳轉到第幾頁？(1-${bookPages.length})`, String(currentPageIndex + 1));
  if (pageNum === null) return;
  const targetPage = parseInt(pageNum);
  if (isNaN(targetPage) || targetPage < 1 || targetPage > bookPages.length) {
    alert(`請輸入 1 到 ${bookPages.length} 之間的數字`);
    return;
  }
  currentPageIndex = targetPage - 1;
  renderCurrentPage();
}

function handleFontSizeChange(event) {
  const size = parseInt(event.target.value);
  applyFontSize(size);
  if (currentBook) {
    setTimeout(() => {
      paginateContent(currentBook.content);
      currentPageIndex = Math.min(currentPageIndex, bookPages.length - 1);
      renderCurrentPage();
    }, 100);
  }
}

function applyFontSize(size) {
  bookText.style.fontSize = `${size}px`;
  fontSizeValue.textContent = `${size}px`;
}

function toggleReadingDirection() {
  isVerticalMode = !isVerticalMode;
  applyReadingDirection();
  saveReadingMode();
  if (currentBook) {
    paginateContent(currentBook.content);
    currentPageIndex = Math.min(currentPageIndex, bookPages.length - 1);
    renderCurrentPage();
  }
}

function applyReadingDirection() {
  bookText.classList.remove('horizontal', 'vertical');
  document.body.classList.remove('horizontal-reading', 'vertical-reading');
  if (isVerticalMode) {
    bookText.classList.add('vertical');
    document.body.classList.add('vertical-reading');
    toggleDirectionButton.textContent = '橫排';
  } else {
    bookText.classList.add('horizontal');
    document.body.classList.add('horizontal-reading');
    toggleDirectionButton.textContent = '直排';
  }
}

function closeBook() {
  currentBook = null;
  bookPages = [];
  currentPageIndex = 0;
  bookTitle.textContent = '';
  bookText.textContent = '';
  readerContent.classList.add('hidden');
  emptyState.classList.remove('hidden');
  headerControls.classList.add('hidden');
  fileInput.value = '';
}

function loadReadingMode() {
  try {
    const mode = localStorage.getItem(READING_MODE_KEY);
    return mode === null ? true : mode === 'vertical';
  } catch (e) {
    return true;
  }
}

function saveReadingMode() {
  try {
    localStorage.setItem(READING_MODE_KEY, isVerticalMode ? 'vertical' : 'horizontal');
  } catch (e) {}
}

// Simplified to Traditional Chinese conversion
let originalContent = null;
let isConverted = false;
let converter = null;

function setupS2TButton() {
  const toggleS2TButton = document.getElementById('toggle-s2t');
  if (!toggleS2TButton) {
    console.log('S2T button not found');
    return;
  }
  
  // Initialize converter when available
  if (typeof OpenCC !== 'undefined') {
    try {
      converter = OpenCC.Converter({ from: 'cn', to: 'tw' });
      console.log('OpenCC converter initialized');
    } catch (e) {
      console.error('OpenCC init failed:', e);
    }
  } else {
    console.error('OpenCC not loaded');
  }
  
  toggleS2TButton.addEventListener('click', () => {
    if (!currentBook) {
      alert('請先開啟檔案');
      return;
    }
    
    if (!converter) {
      alert('OpenCC 未載入');
      return;
    }
    
    if (!originalContent) {
      originalContent = currentBook.content;
    }
    
    isConverted = !isConverted;
    
    if (isConverted) {
      toggleS2TButton.textContent = '繁→簡';
      try {
        currentBook.content = converter(originalContent);
        console.log('Converted to Traditional');
      } catch (e) {
        console.error('Conversion failed:', e);
        alert('轉換失敗: ' + e.message);
        isConverted = false;
        toggleS2TButton.textContent = '簡→繁';
        return;
      }
    } else {
      toggleS2TButton.textContent = '簡→繁';
      currentBook.content = originalContent;
      console.log('Restored to original');
    }
    
    const currentPosition = getCurrentCharPosition();
    paginateContent(currentBook.content);
    restoreReadingPosition(currentPosition);
    renderCurrentPage();
  });
  
  console.log('S2T button setup complete');
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupS2TButton);
} else {
  setupS2TButton();
}

// Bookshelf UI functions
let currentBookId = null;

const viewBookshelfButton = document.getElementById('view-bookshelf');
const closeBookshelfButton = document.getElementById('close-bookshelf');
const addToShelfButton = document.getElementById('add-to-shelf');
const bookshelfDiv = document.getElementById('bookshelf');
const booksListDiv = document.getElementById('books-list');
const emptyBookshelfDiv = document.getElementById('empty-bookshelf');

async function showBookshelf() {
  emptyState.classList.add('hidden');
  readerContent.classList.add('hidden');
  bookshelfDiv.classList.remove('hidden');
  headerControls.classList.add('hidden');
  
  await loadBookshelf();
}

async function hideBookshelf() {
  bookshelfDiv.classList.add('hidden');
  emptyState.classList.remove('hidden');
}

async function loadBookshelf() {
  try {
    const books = await getAllBooks();
    booksListDiv.innerHTML = '';
    
    if (books.length === 0) {
      booksListDiv.classList.add('hidden');
      emptyBookshelfDiv.classList.remove('hidden');
      return;
    }
    
    booksListDiv.classList.remove('hidden');
    emptyBookshelfDiv.classList.add('hidden');
    
    // Sort by last read (most recent first)
    books.sort((a, b) => b.lastReadAt - a.lastReadAt);
    
    books.forEach(book => {
      const bookCard = document.createElement('div');
      bookCard.className = 'border border-gray-200 rounded-lg p-4 hover:shadow-md transition-shadow cursor-pointer relative';
      
      const progress = book.progress || 0;
      const progressPercent = Math.round(progress * 100);
      
      bookCard.innerHTML = `
        <div class="flex flex-col h-full">
          <h3 class="font-semibold text-gray-900 mb-2 line-clamp-2">${book.title}</h3>
          <div class="text-sm text-gray-500 mb-2">
            <p>最後閱讀: ${new Date(book.lastReadAt).toLocaleDateString('zh-TW')}</p>
            <p>進度: ${progressPercent}%</p>
          </div>
          <div class="mt-auto">
            <div class="w-full bg-gray-200 rounded-full h-2">
              <div class="bg-blue-600 h-2 rounded-full" style="width: ${progressPercent}%"></div>
            </div>
          </div>
          <button class="delete-book absolute top-2 right-2 text-red-500 hover:text-red-700" data-id="${book.id}">
            ✕
          </button>
        </div>
      `;
      
      bookCard.addEventListener('click', (e) => {
        if (e.target.classList.contains('delete-book')) {
          e.stopPropagation();
          deleteBookFromShelf(book.id);
        } else {
          openBookFromShelf(book.id);
        }
      });
      
      booksListDiv.appendChild(bookCard);
    });
  } catch (err) {
    console.error('Load bookshelf failed:', err);
    alert('載入書櫃失敗');
  }
}

async function openBookFromShelf(id) {
  try {
    const book = await getBookById(id);
    if (!book) {
      alert('找不到這本書');
      return;
    }
    
    currentBookId = id;
    displayBook(book.title, book.content, book);
    bookshelfDiv.classList.add('hidden');
  } catch (err) {
    console.error('Open book failed:', err);
    alert('開啟失敗');
  }
}

async function addCurrentBookToShelf() {
  if (!currentBook) {
    alert('沒有開啟的書');
    return;
  }
  
  try {
    const id = await saveBookToShelf(currentBook.title, currentBook.content);
    currentBookId = id;
    alert('已加入書櫃！');
    addToShelfButton.textContent = '✓ 已在書櫃';
    addToShelfButton.disabled = true;
  } catch (err) {
    console.error('Add to shelf failed:', err);
    alert('加入失敗');
  }
}

async function deleteBookFromShelf(id) {
  if (!confirm('確定要從書櫃移除這本書嗎？')) return;
  
  try {
    await deleteBook(id);
    await loadBookshelf();
  } catch (err) {
    console.error('Delete book failed:', err);
    alert('刪除失敗');
  }
}

// Event listeners
viewBookshelfButton.addEventListener('click', showBookshelf);
closeBookshelfButton.addEventListener('click', hideBookshelf);
addToShelfButton.addEventListener('click', addCurrentBookToShelf);

// Update displayBook to handle saved books
const originalDisplayBook = displayBook;
function displayBook(title, content, savedBook = null) {
  originalDisplayBook(title, content);
  
  if (savedBook) {
    // Restore saved settings
    if (savedBook.fontSize) {
      fontSizeInput.value = savedBook.fontSize;
      applyFontSize(savedBook.fontSize);
    }
    
    if (typeof savedBook.isVertical === 'boolean') {
      isVerticalMode = savedBook.isVertical;
      applyReadingDirection();
    }
    
    // Restore page position
    if (savedBook.currentPage !== undefined) {
      currentPageIndex = savedBook.currentPage;
      renderCurrentPage();
    }
    
    addToShelfButton.textContent = '✓ 已在書櫃';
    addToShelfButton.disabled = true;
  } else {
    currentBookId = null;
    addToShelfButton.textContent = '+ 書櫃';
    addToShelfButton.disabled = false;
  }
}

// Save progress when page changes
const originalRenderCurrentPage = renderCurrentPage;
function renderCurrentPage() {
  originalRenderCurrentPage();
  
  if (currentBookId && currentBook) {
    const progress = (currentPageIndex + 1) / bookPages.length;
    updateBookProgress(
      currentBookId,
      progress,
      currentPageIndex,
      parseInt(fontSizeInput.value),
      isVerticalMode
    ).catch(err => console.error('Save progress failed:', err));
  }
}
