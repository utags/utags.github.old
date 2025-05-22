<script lang="ts">
  import * as m from '../paraglide/messages'
  import { commandManager } from '../stores/command-store'
  import { AddTagCommand } from '../lib/tag-commands'
  import { bookmarkStorage } from '../lib/bookmark-storage'
  import TagInput from './TagInput.svelte'
  import Modal from './Modal.svelte'

  // Props
  let {
    selectedBookmarkUrls = [],
    isOpen = $bindable(false),
  }: {
    selectedBookmarkUrls: string[]
    isOpen: boolean
  } = $props()

  // State
  let tagsToAdd = $state<string[]>([])
  let isProcessing = $state(false)
  let errorMessage = $state('')
  let successMessage = $state('')

  /**
   * Close the modal and reset state
   */
  function closeModal() {
    resetState()
    isOpen = false
  }

  /**
   * Reset the component state
   */
  function resetState() {
    tagsToAdd = []
    errorMessage = ''
    successMessage = ''
    isProcessing = false
  }

  /**
   * Add tags to selected bookmarks
   */
  async function addTagsToBookmarks() {
    if (tagsToAdd.length === 0) {
      errorMessage = m.BOOKMARK_FORM_TAGS_ERROR_EMPTY()
      return
    }

    if (selectedBookmarkUrls.length === 0) {
      errorMessage = m.BATCH_TAG_ADD_MODAL_ERROR_NO_BOOKMARKS_SELECTED()
      return
    }

    isProcessing = true
    errorMessage = ''
    successMessage = ''

    try {
      const bookmarksToUpdate =
        await bookmarkStorage.getBookmarksAsArrayByKeys(selectedBookmarkUrls)
      // Create and execute the add tag command for each bookmark
      const addTagCommand = new AddTagCommand(bookmarksToUpdate, tagsToAdd)
      await commandManager.executeCommand(addTagCommand, bookmarksToUpdate)

      successMessage = m.BATCH_TAG_ADD_MODAL_SUCCESS_MESSAGE({
        tagsCount: tagsToAdd.length,
        bookmarksCount: selectedBookmarkUrls.length,
      })

      // Reset tags input after successful operation
      tagsToAdd = []

      // Close modal after a short delay to show success message
      setTimeout(() => {
        closeModal()
      }, 1500)
    } catch (error) {
      errorMessage = m.BATCH_TAG_ADD_MODAL_ERROR_ADD_FAILED({
        errorDetails: error instanceof Error ? error.message : String(error),
      })
    } finally {
      isProcessing = false
    }
  }
</script>

<Modal
  title={m.BATCH_TAG_ADD_MODAL_TITLE()}
  {isOpen}
  onOpen={() => {
    document.getElementById('tags')?.focus()
  }}
  onClose={closeModal}
  onConfirm={addTagsToBookmarks}
  disableConfirm={isProcessing || tagsToAdd.length === 0}
  confirmText={isProcessing
    ? m.PROCESSING_TEXT()
    : m.BOOKMARK_LIST_BATCH_ADD_TAGS()}>
  <div class="mb-4">
    <p class="mb-2 text-sm text-gray-600 dark:text-gray-400">
      {m.BATCH_TAG_ADD_MODAL_SELECTED_BOOKMARKS_COUNT({
        count: selectedBookmarkUrls.length,
      })}
    </p>
    <div class="mb-4">
      <label
        for="tags"
        class="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
        {m.BOOKMARK_LIST_BATCH_ADD_TAGS()}
      </label>
      <TagInput id="tags" bind:tags={tagsToAdd} />
      <p class="mt-1 text-xs text-gray-500 dark:text-gray-400">
        {m.TAG_INPUT_HINT_ENTER_COMMA_SEPARATOR()}
      </p>
    </div>
  </div>

  {#if errorMessage}
    <div
      class="mb-4 rounded-md bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-400">
      {errorMessage}
    </div>
  {/if}

  {#if successMessage}
    <div
      class="mb-4 rounded-md bg-green-50 p-3 text-sm text-green-700 dark:bg-green-900/20 dark:text-green-400">
      {successMessage}
    </div>
  {/if}
</Modal>
