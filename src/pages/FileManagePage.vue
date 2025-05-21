<script setup lang="ts">
import { onBeforeMount, ref, type Ref, computed } from 'vue';
import { formatBytes, formatDate } from '@/utils/utils';
import { DeleteFile, ListFiles } from '@/api';
import type { _Object } from '@aws-sdk/client-s3';

const filesPerPage = 100; // Max items per request
let uploadedFiles: Ref<_Object[]> = ref([]);
const sortKey: Ref<'name' | 'lastModified'> = ref('name');
const sortOrder: Ref<'asc' | 'desc'> = ref('asc');
const nextContinuationToken: Ref<string | undefined> = ref(undefined);
const isLoading: Ref<boolean> = ref(false);

function decodeKey(key: string) {
    return decodeURIComponent(key)
}

const sortedFiles = computed(() => {
    const files = [...uploadedFiles.value];
    files.sort((a, b) => {
        let valA, valB;

        if (sortKey.value === 'name') {
            valA = decodeKey(a.Key || '').toLowerCase();
            valB = decodeKey(b.Key || '').toLowerCase();
        } else { // lastModified
            valA = a.LastModified?.getTime() || 0;
            valB = b.LastModified?.getTime() || 0;
        }

        if (valA < valB) {
            return sortOrder.value === 'asc' ? -1 : 1;
        }
        if (valA > valB) {
            return sortOrder.value === 'asc' ? 1 : -1;
        }
        return 0;
    });
    return files;
});

const loadFilesChunk = async (isLoadMore = false) => {
    if (isLoading.value) return;
    isLoading.value = true;

    try {
        const res = await ListFiles(
            filesPerPage.toString(), 
            undefined, // No prefix for now
            isLoadMore ? nextContinuationToken.value : undefined
        );

        if (res.Contents) {
            if (isLoadMore) {
                uploadedFiles.value.push(...res.Contents);
            } else {
                uploadedFiles.value = res.Contents;
            }
        } else if (!isLoadMore) {
            uploadedFiles.value = [];
        }
        
        nextContinuationToken.value = res.NextContinuationToken;

    } catch (error) {
        console.error("Error loading files:", error);
        // Optionally, show a toast or error message to the user
        if (!isLoadMore) {
            uploadedFiles.value = [];
            nextContinuationToken.value = undefined;
        }
    } finally {
        isLoading.value = false;
    }
};

const refreshFiles = async () => {
    // Reset state for a full refresh
    nextContinuationToken.value = undefined; 
    await loadFilesChunk(false); // Load the first chunk
};

onBeforeMount(async () => {
    await refreshFiles();
});

const onDeleteFileClick = async (key?: string) => {
    if (!key) {
        return;
    }
    await DeleteFile(key);
    // After deletion, refresh the entire list from the beginning
    // as pagination state might be inconsistent.
    await refreshFiles(); 
};

const setSort = (newSortKey: 'name' | 'lastModified') => {
    if (sortKey.value === newSortKey) {
        sortOrder.value = sortOrder.value === 'asc' ? 'desc' : 'asc';
    } else {
        sortKey.value = newSortKey;
        sortOrder.value = 'asc';
    }
};
</script>

<template>
    <div class="flex flex-col items-center mt-5">
        <h1 class="text-lg">{{ $t("page_title.filemanage") }}</h1>
        <div class="px-4 py-4 max-w-screen-md w-4/5">
            <!-- Sort Controls -->
            <div class="flex justify-between items-center mb-4">
                <div>
                    <!-- Placeholder for potential future controls like a manual refresh button -->
                </div>
                <div class="flex">
                <button @click="setSort('name')" class="mr-2 px-3 py-1 border rounded" :class="{'bg-blue-500 text-white': sortKey === 'name'}">
                    Sort by Name {{ sortKey === 'name' ? (sortOrder === 'asc' ? '↑' : '↓') : '' }}
                </button>
                <button @click="setSort('lastModified')" class="px-3 py-1 border rounded" :class="{'bg-blue-500 text-white': sortKey === 'lastModified'}">
                    Sort by Date {{ sortKey === 'lastModified' ? (sortOrder === 'asc' ? '↑' : '↓') : '' }}
                </button>
            </div>
            <div v-for="file in sortedFiles" :key="file.Key"
                class="w-full flex flex-row items-center mt-4 rounded border-1 border-gray-300 px-2 py-1">
                <div class="w-10 h-10 i-mdi-file-document-outline"></div>
                <div class="flex flex-col title">
                    <a class="text-lg font-semibold" :title="decodeKey(file.Key!)" :href="`/${file.Key}`" target="_blank">{{ decodeKey(file.Key!) }}</a>
                    <div class="text-sm text-gray">{{ formatBytes(file.Size ?? 0) }}</div>
                    <div class="text-xs text-gray-500">{{ formatDate(file.LastModified) }}</div>
                </div>
                <div class="ml-auto w-6 h-6 i-mdi-trash-can-outline cursor-pointer"
                    @click="onDeleteFileClick(file.Key)"></div>
            </div>

            <!-- Load More Button -->
            <div v-if="nextContinuationToken" class="flex justify-center mt-4">
                <button @click="loadFilesChunk(true)" :disabled="isLoading"
                    class="px-4 py-2 border rounded bg-blue-500 text-white hover:bg-blue-600 disabled:bg-gray-400">
                    {{ isLoading ? 'Loading...' : 'Load More' }}
                </button>
            </div>
             <div v-if="isLoading && !nextContinuationToken" class="flex justify-center mt-4">
                <p>Loading initial files...</p> <!-- Optional: Message for initial load -->
            </div>
        </div>
    </div>
</template>

<style>
html,
body,
#app {
    margin: 0;
    padding: 0;
    background-color: #f8f9fa;
}
.title {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
}
</style>
