import './style.css'

document.querySelector<HTMLDivElement>('#app')!.innerHTML = `
  <div class="min-h-screen bg-gray-100 flex items-center justify-center">
    <div class="bg-white p-8 rounded-lg shadow-lg max-w-md">
      <h1 class="text-3xl font-bold text-blue-600 mb-4">Tess</h1>
      <p class="text-gray-700 mb-4">
        A browser-based DOCX inspection tool for exploring OPC packages at a structural and XML level.
      </p>
      <button id="counter" class="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded">
        Count: 0
      </button>
    </div>
  </div>
`

let count = 0
const counterButton = document.querySelector<HTMLButtonElement>('#counter')!
counterButton.addEventListener('click', () => {
  count++
  counterButton.textContent = `Count: ${count}`
})
