<script setup lang="ts">
defineProps<{
    msg: string;
    status: string;
}>();

// This will cause a runtime error to test the overlay when button is clicked
const triggerError = () => {
    // Use setTimeout to ensure error happens outside Vue's error handling
    setTimeout(() => {
        throw new Error("Test error from Vue component");
    }, 0);
};
</script>

<template>
    <div class="greetings">
        <h1 class="green">{{ msg }}</h1>
        <h3>
            You’ve successfully created a project with
            <a href="https://vite.dev/" target="_blank" rel="noopener">Vite</a> + <a href="https://vuejs.org/" target="_blank" rel="noopener">Vue 3</a>.
        </h3>
        <button
            @click="triggerError"
            style="margin-top: 20px; padding: 10px 20px; background: red; color: white; border: none; border-radius: 5px; cursor: pointer"
        >
            Trigger Error (Test Overlay)
        </button>
    </div>
</template>

<style scoped>
h1 {
    font-weight: 500;
    font-size: 2.6rem;
    position: relative;
    top: -10px;
}

h3 {
    font-size: 1.2rem;
}

.greetings h1,
.greetings h3 {
    text-align: center;
}

@media (min-width: 1024px) {
    .greetings h1,
    .greetings h3 {
        text-align: left;
    }
}
</style>
