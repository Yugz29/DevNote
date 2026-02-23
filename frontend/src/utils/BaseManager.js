/**
 * BaseManager — Abstract class common to NoteManager, SnippetManager, TodoManager
 * Manages pagination (infinite scroll) and the load/display/events lifecycle
 */
export default class BaseManager {

    constructor(modal, container) {
        this.modal = modal;
        this.container = container;
        this.projectId = null;
        this.nextPageUrl = null;
        this.isLoading = false;
        this.setupInfiniteScroll();
    }

    setProject(projectId) {
        this.projectId = projectId;
    }

    async load() {
        if (!this.projectId) return;

        this.nextPageUrl = null;
        this.isLoading = true;
        this.container.innerHTML = '<p class="loading">Loading...</p>';

        try {
            const data = await this.fetchPage(this.projectId);
            this.nextPageUrl = data.next ?? null;
            const items = data.results ?? data;
            await this.display(items);
            this.attachEventListeners(items);
        } catch (error) {
            console.error('Error loading content', error);
            this.container.innerHTML = '<p class="error">Unable to load content</p>';
        } finally {
            this.isLoading = false;
        }
    }

    async loadMore() {
        if (this.isLoading || !this.nextPageUrl || !this.projectId) return;

        this.isLoading = true;

        try {
            const data = await this.fetchPage(null, this.nextPageUrl);
            this.nextPageUrl = data.next ?? null;
            const items = data.results ?? data;
            await this.appendItems(items);
            this.attachEventListeners(items);
        } catch (error) {
            console.error('Error loading more content:', error);
        } finally {
            this.isLoading = false;
        }
    }

    setupInfiniteScroll() {
        const scrollContainer = document.querySelector('.tab-content');
        if (!scrollContainer) return;

        scrollContainer.addEventListener('scroll', () => {
            const distanceFromBottom =
                scrollContainer.scrollHeight -
                scrollContainer.scrollTop -
                scrollContainer.clientHeight;

            if (distanceFromBottom < 100) {
                this.loadMore();
            }
        });
    }

    /**
     * Highlights a search query in the container and scrolls to the target item.
     * @param {string} query - Search term to highlight
     * @param {string|null} itemId - ID of the item to scroll to
     */
    highlight(query, itemId = null) {
        if (!query) return;

        const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, String.raw`\$&`);
        const regex = new RegExp('(' + escaped + ')', 'gi');

        // Highlight in titles
        this.container.querySelectorAll('.note-block-title, .snippet-title, .todo-title').forEach(el => {
            el.innerHTML = el.textContent.replace(regex, '<mark class="search-highlight">$1</mark>');
        });

        // Highlight in content / description / preview
        this.container.querySelectorAll('.note-block-content, .snippet-description, .todo-description').forEach(el => {
            el.innerHTML = el.innerHTML.replace(regex, '<mark class="search-highlight">$1</mark>');
        });

        // Scroll to the target item and flash it
        if (itemId) {
            const target = this.container.querySelector('[data-id="' + itemId + '"]');
            if (target) {
                setTimeout(() => target.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100);
                target.classList.add('search-target');
                setTimeout(() => target.classList.remove('search-target'), 2000);
            }
        }
    }

    // ============================================================
    // ABSTRACT METHODS — To be implemented in each child manager
    // ============================================================

    async fetchPage(projectId, url = null) {
        throw new Error('fetchPage() must be implemented in child class');
    }

    async display(items) {
        throw new Error('display() must be implemented in child class');
    }

    async appendItems(items) {
        throw new Error('appendItems() must be implemented in child class');
    }

    attachEventListeners(items) {
        throw new Error('attachEventListeners() must be implemented in child class');
    }
}
