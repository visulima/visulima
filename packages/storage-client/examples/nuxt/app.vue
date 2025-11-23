<template>
    <div class="app">
        <h1>Storage Client - Nuxt Example</h1>
        <div class="upload-section">
            <input type="file" @change="handleFileChange" :disabled="isUploading" ref="fileInputRef" />
            <button @click="handleUpload" :disabled="!file || isUploading">
                {{ isUploading ? "Uploading..." : "Upload" }}
            </button>
            <button @click="handleReset" :disabled="isUploading">Reset</button>
        </div>
        <div v-if="isUploading" class="progress-section">
            <div>Progress: {{ progress }}%</div>
            <progress :value="progress" max="100" />
        </div>
        <div v-if="error" class="error">Error: {{ error.message }}</div>
        <div v-if="result" class="success">Upload complete! File: {{ result.filename }}</div>
    </div>
</template>

<script setup lang="ts">
import { ref } from "vue";

import { useUpload } from "@visulima/storage-client/vue";

const file = ref<File | null>(null);
const fileInputRef = ref<HTMLInputElement | null>(null);
const { upload, progress, isUploading, error, result, reset } = useUpload({
    endpointMultipart: "/api/upload/multipart",
    endpointTus: "/api/upload/tus",
    onSuccess: (result) => {
        console.log("Upload successful:", result);
        file.value = null;
        if (fileInputRef.value) {
            fileInputRef.value.value = "";
        }
    },
    onError: (error_) => {
        console.error("Upload error:", error_);
    },
});

const handleFileChange = (e: Event) => {
    const target = e.target as HTMLInputElement;
    const selectedFile = target.files?.[0];
    file.value = selectedFile || null;
};

const handleUpload = async () => {
    if (file.value) {
        try {
            await upload(file.value);
        } catch (error_) {
            console.error("Upload failed:", error_);
        }
    }
};

const handleReset = () => {
    reset();
    file.value = null;
    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
    if (fileInput) {
        fileInput.value = "";
    }
};
</script>

<style scoped>
.app {
    max-width: 800px;
    margin: 0 auto;
    padding: 2rem;
    text-align: center;
}

.upload-section {
    margin: 2rem 0;
    display: flex;
    gap: 1rem;
    justify-content: center;
    align-items: center;
}

.upload-section input[type="file"] {
    padding: 0.5rem;
}

.upload-section button {
    padding: 0.5rem 1rem;
    background-color: #00dc82;
    color: white;
    border: none;
    border-radius: 4px;
    cursor: pointer;
}

.upload-section button:disabled {
    background-color: #ccc;
    cursor: not-allowed;
}

.progress-section {
    margin: 2rem 0;
}

.progress-section progress {
    width: 100%;
    max-width: 400px;
    height: 20px;
}

.error {
    margin: 1rem 0;
    padding: 1rem;
    background-color: #fee;
    color: #c33;
    border-radius: 4px;
}

.success {
    margin: 1rem 0;
    padding: 1rem;
    background-color: #efe;
    color: #3c3;
    border-radius: 4px;
}
</style>
