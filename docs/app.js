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
    // Vertical mode: use fixed safe value for reliability
    // Measurement-based approach causes edge cutoff on mobile
    // Trade capacity for zero cutoff guarantee
    const safeChars = 250;
    console.log('Vertical - using fixed safe value:', safeChars);
    return safeChars;
    
  } else {
    // Horizontal mode - existing calculation works fine
    const usableHeight = Math.floor(containerHeight * 0.70);
    const usableWidth = Math.floor(containerWidth * 0.90);
    
    const lineHeightPx = fontSize * lineHeight;
    const numLines = Math.floor(usableHeight / (lineHeightPx * 1.2));
    const charsPerLine = Math.floor(usableWidth / (fontSize * 0.8));
    const total = Math.max(numLines * charsPerLine, 50);
    
    console.log('Horizontal - lines:', numLines, 'chars/line:', charsPerLine, 'total:', total);
    return total;
  }
}

function paginateContent(content) {
  bookPages = [];
  const charsPerPage = calculateCharsPerPage();
  
  // For vertical mode: large fixed overlap to ensure continuity
  const overlap = isVerticalMode ? 100 : 0; // Fixed 100 chars overlap
  
  console.log('Pagination - mode:', isVerticalMode ? 'vertical' : 'horizontal', 'chars/page:', charsPerPage, 'overlap:', overlap);
  
  let i = 0;
  while (i < content.length) {
    const end = Math.min(i + charsPerPage, content.length);
    bookPages.push(content.substring(i, end));
    i += charsPerPage - overlap; // Move forward, minus overlap
    
    // Debug: show first 20 chars of each page
    if (bookPages.length <= 3) {
      console.log(`Page ${bookPages.length} starts with:`, content.substring(i, i + 20));
    }
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
