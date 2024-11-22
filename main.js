//Anmod om API key
function requestAPIKey() {
    let apiKey = localStorage.getItem('OPENAI_API_KEY');

    if (!apiKey) {
        apiKey = prompt("Indtast din OpenAI API-nøgle for at fortsætte:");
        if (apiKey) {
            localStorage.setItem('OPENAI_API_KEY', apiKey);
            alert('API-nøgle gemt!');
        } else {
            alert('Du skal indsætte en API-nøgle for at bruge denne side.');
        }
    }

    return apiKey;
}

document.addEventListener('DOMContentLoaded', () => {
    requestAPIKey();
    loadPreferences(); // Indlæs brugerens gemte præferencer
});


let points = 0;

// Gem præferencer
function savePreferences() {
    const preferences = {
        mealTypes: getCheckedValues('mealType'),
        ingredients: getCheckedValues('ingredient'),
        times: getCheckedValues('time'),
        themes: getCheckedValues('theme'),
        people: getCheckedValues('people'),
        moods: getCheckedValues('mood'),
        language: document.getElementById('language').value,
        pirateMode: document.getElementById('pirateMode').checked
    };
    localStorage.setItem('preferences', JSON.stringify(preferences));
    alert('Præferencer gemt!');
}

// Gendan præferencer
function loadPreferences() {
    const preferences = JSON.parse(localStorage.getItem('preferences'));
    if (preferences) {
        Object.entries(preferences).forEach(([key, value]) => {
            if (Array.isArray(value)) {
                value.forEach(v => {
                    const input = document.querySelector(`input[name="${key}"][value="${v}"]`);
                    if (input) input.checked = true;
                });
            } else if (key === 'language') {
                document.getElementById('language').value = value;
            } else if (key === 'pirateMode') {
                document.getElementById('pirateMode').checked = value;
            }
        });
    }
}

// Tilføj point
function addPoints(action) {
    const pointsMap = { generate: 10, save: 5, share: 15 };
    points += pointsMap[action];
    document.getElementById('points').textContent = points;
    alert(`Du har optjent ${pointsMap[action]} point! Samlet: ${points} point.`);
}

// Håndter formularindsendelse
document.getElementById('recipeForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    savePreferences(); // Gem valgene automatisk
    addPoints('generate'); // Tilføj point for at generere opskrifter

    const loadingDiv = document.getElementById('loading');
    const resultsDiv = document.getElementById('results');
    loadingDiv.style.display = 'block';
    resultsDiv.innerHTML = '';

    const mealTypes = getCheckedValues('mealType');
    const ingredients = getCheckedValues('ingredient');
    const times = getCheckedValues('time');
    const themes = getCheckedValues('theme');
    const people = getCheckedValues('people');

    if (!mealTypes.length || !ingredients.length || !times.length || !themes.length || !people.length) {
        loadingDiv.style.display = 'none';
        displayError('Du skal vælge mindst én mulighed i hver kategori.');
        return;
    }

    const prompts = generateIndividualPrompts(mealTypes, ingredients, times, themes, people);

    try {
        await fetchAndDisplayRecipes(prompts);
    } catch (error) {
        console.error('Fejl ved generering af opskrifter:', error);
        displayError('Noget gik galt. Prøv igen senere.');
    } finally {
        loadingDiv.style.display = 'none';
    }
});

// Gendan præferencer ved sideindlæsning
document.addEventListener('DOMContentLoaded', loadPreferences);

// Saml markerede værdier fra checkbokse
function getCheckedValues(name) {
    return [...document.querySelectorAll(`input[name="${name}"]:checked`)].map(input => input.value);
}

// Generer individuelle prompts
function generateIndividualPrompts(mealTypes, ingredients, times, themes, people) {
    const isPirate = document.getElementById('pirateMode').checked;
    const moods = getCheckedValues('mood');
    const language = document.getElementById('language').value;

    const pirateAddition = isPirate
        ? `Skriv opskrifterne som en ægte pirat! Brug udtryk som "Arrr!" og "Skib o'hoj!".`
        : '';

    const moodAddition = moods.length > 0 ? `- Stemning: ${moods.join(', ')}` : '';
    const languagePrompt = `Opskrifterne skal være på ${language}.`;

    return Array.from({ length: 5 }).map((_, index) => `
        Lav opskrift ${index + 1} baseret på følgende kriterier:
        - Måltidstyper: ${mealTypes.join(', ')}
        - Ingredienser: ${ingredients.join(', ')}
        - Tidsrammer: ${times.join(', ')}
        - Temaer: ${themes.join(', ')}
        - Antal personer: ${people.join(', ')}
        ${moodAddition}
        ${pirateAddition}
        ${languagePrompt}

        1. En overskrift, der kun indeholder navnet på retten (uden "Opskrift 1" eller lignende).
        2. Ingredienser i punktform.
        3. Fremgangsmåde opdelt i trin.

        Undgå generiske beskrivelser og tilføj anbefalede krydderier, alternativer til ingredienser og tilberedningsmetoder.
        Anvend gerne en hyggelig tone, eller charmerende måde at beskrive det på.
    `);
}

// Hent og vis opskrifter
async function fetchAndDisplayRecipes(prompts) {
    const resultsDiv = document.getElementById('results');
    for (const [index, prompt] of prompts.entries()) {
        try {
            const recipe = await fetchRecipeFromOpenAI(prompt);
            const [title, ...details] = recipe.split('\n');
            const cleanTitle = cleanMarkdown(title);
            const cleanDetails = details.map(detail => cleanMarkdown(detail)).join('<br>');

            resultsDiv.innerHTML += `
                <div class="recipe">
                    <button class="recipe-title" data-index="${index}">${cleanTitle}</button>
                    <div id="details-${index}" class="recipe-details" style="display: none;">
                        ${cleanDetails}
                        <button class="export-button" onclick="exportToPDF('${cleanTitle}', '${cleanDetails.replace(/'/g, "\\'")}')">Eksportér til PDF</button>
                    </div>
                </div>
            `;
        } catch (error) {
            console.error(`Fejl ved generering af opskrift ${index + 1}:`, error);
        }
    }

    resultsDiv.addEventListener('click', (event) => {
        if (event.target.classList.contains('recipe-title')) {
            const index = event.target.getAttribute('data-index');
            toggleDetails(index);
        }
    });
}

// Generer madplan
async function generateMealPlan() {
    const loadingDiv = document.getElementById('loading');
    const mealPlanDiv = document.getElementById('mealPlan');
    const prompts = generateIndividualPrompts(
        getCheckedValues('mealType'),
        getCheckedValues('ingredient'),
        getCheckedValues('time'),
        getCheckedValues('theme'),
        getCheckedValues('people')
    );

    mealPlanDiv.innerHTML = '';
    loadingDiv.style.display = 'block';

    try {
        const plan = [];
        for (let i = 0; i < 7; i++) {
            const dayPrompt = `${prompts[0]} Dette er til dag ${i + 1}.`;
            const recipe = await fetchRecipeFromOpenAI(dayPrompt);
            plan.push(`<strong>Dag ${i + 1}</strong>: ${recipe}`);
        }
        mealPlanDiv.innerHTML = plan.join('<br><br>');
    } catch (error) {
        console.error('Fejl ved generering af madplan:', error);
        mealPlanDiv.innerHTML = '<p style="color: red;">Noget gik galt med madplanen.</p>';
    } finally {
        loadingDiv.style.display = 'none';
    }
}

// Kald OpenAI API
async function fetchRecipeFromOpenAI(prompt) {
    const apiKey = requestAPIKey();

    if (!apiKey) {
        throw new Error("Ingen API-nøgle fundet. Indtast en gyldig API-nøgle for at fortsætte.");
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
            model: 'gpt-3.5-turbo',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 500
        })
    });

    if (!response.ok) throw new Error(`OpenAI API-fejl: ${response.statusText}`);

    const data = await response.json();
    return data.choices[0].message.content;
}

// Rens markdown
function cleanMarkdown(text) {
    return text.replace(/##+ /g, '').replace(/Opskrift\s*\d+:?\s*/i, '').trim();
}

// Vis/skjul detaljer
function toggleDetails(index) {
    const detailsDiv = document.getElementById(`details-${index}`);
    detailsDiv.style.display = detailsDiv.style.display === 'none' ? 'block' : 'none';
}

// Eksporter til PDF
function exportToPDF(title, content) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF();
    doc.text(title, 10, 10);
    doc.text(content, 10, 20);
    doc.save(`${title}.pdf`);
}

// Fejlmeddelelse
function displayError(message) {
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = `<p style="color: red;">${message}</p>`;
}
