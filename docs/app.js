// Simple eBook Reader - Working version

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

function handleFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;
  if (!file.name.endsWith('.txt')) {
    alert('Only TXT files supported');
    return;
  }
  const reader = new FileReader();
  reader.onload = (e) => displayBook(file.name, e.target.result);
  reader.onerror = () => alert('Error reading file');
  reader.readAsText(file);
}

function displayBook(title, content) {
  currentBook = { title, content };
  bookTitle.textContent = title;
  
  const savedFontSize = 24;
  fontSizeInput.value = savedFontSize;
  applyFontSize(savedFontSize);
  
  isVerticalMode = loadReadingMode();
  applyReadingDirection();
  
  paginateContent(content);
  currentPageIndex = 0;
  renderCurrentPage();
  
  emptyState.classList.add('hidden');
  readerContent.classList.remove('hidden');
  headerControls.classList.remove('hidden');
}

function calculateCharsPerPage() {
  const fontSize = parseInt(fontSizeInput.value);
  const lineHeight = 1.8;
  
  // Get actual element dimensions
  const availableHeight = bookText.clientHeight || 600;
  const availableWidth = bookText.clientWidth || 800;
  
  // Calculate usable space with generous bottom margin
  const usableHeight = availableHeight - 80; // Extra margin for safety
  const usableWidth = availableWidth - 24;
  
  if (isVerticalMode) {
    // Vertical: calculate columns and chars per column
    const charsPerColumn = Math.floor(usableHeight / (fontSize * 1.25));
    const numColumns = Math.floor(usableWidth / (fontSize * lineHeight * 1.1));
    // Ultra-conservative for vertical
    return Math.max(Math.floor(charsPerColumn * numColumns * 0.35), 80);
  } else {
    // Horizontal: calculate exact number of lines that fit
    const lineHeightPx = fontSize * lineHeight;
    const numLines = Math.floor(usableHeight / lineHeightPx);
    
    // Calculate chars per line (average Chinese char width ~= fontSize * 0.65)
    const charsPerLine = Math.floor(usableWidth / (fontSize * 0.7));
    
    // Total chars = lines * chars per line, with 40% safety margin
    return Math.max(Math.floor(numLines * charsPerLine * 0.4), 150);
  }
}

function paginateContent(content) {
  bookPages = [];
  let remainingContent = content;
  
  // Initial guess for chars per page
  let charsPerPage = calculateCharsPerPage();
  
  while (remainingContent.length > 0) {
    // Try with current estimate
    let testContent = remainingContent.substring(0, charsPerPage);
    
    // Render it temporarily to measure actual height
    bookText.textContent = testContent;
    
    // Get dimensions
    const availableHeight = bookText.clientHeight;
    const safeHeight = availableHeight * 0.92; // Use 92% (8% bottom margin)
    
    // Iteratively reduce until it fits
    let iterations = 0;
    while (bookText.scrollHeight > safeHeight && testContent.length > 10 && iterations < 20) {
      charsPerPage = Math.floor(charsPerPage * 0.92); // Reduce by 8%
      testContent = remainingContent.substring(0, charsPerPage);
      bookText.textContent = testContent;
      iterations++;
    }
    
    // Save this page
    if (testContent.length > 0) {
      bookPages.push(testContent);
      remainingContent = remainingContent.substring(testContent.length);
    } else {
      // Prevent infinite loop - force at least 1 char
      bookPages.push(remainingContent.substring(0, 1));
      remainingContent = remainingContent.substring(1);
    }
  }
  
  bookText.textContent = ''; // Clear test content
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
}

function goToFirstPage() {
  if (currentPageIndex === 0) return;
  currentPageIndex = 0;
  renderCurrentPage();
}

function goToLastPage() {
  if (currentPageIndex === bookPages.length - 1) return;
  currentPageIndex = bookPages.length - 1;
  renderCurrentPage();
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
