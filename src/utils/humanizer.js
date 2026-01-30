/**
 * Utilitários para simular comportamento humano no Playwright
 */

// Gera um atraso aleatório entre min e max milissegundos
const randomDelay = async (page, min = 2000, max = 5000) => {
    const delay = Math.floor(Math.random() * (max - min + 1) + min);
    await page.waitForTimeout(delay);
};

// Move o mouse de forma curva e "trêmula" (Bezier Curve simplificada)
// O LinkedIn rastreia se o mouse vai em linha reta (robô) ou curva (humano)
const humanMouseMove = async (page) => {
    try {
        // Pega o tamanho da tela
        const viewport = page.viewportSize();
        if (!viewport) return;

        // Ponto de destino aleatório
        const x = Math.floor(Math.random() * viewport.width);
        const y = Math.floor(Math.random() * viewport.height);

        // Move em passos para simular velocidade variável
        await page.mouse.move(x, y, { steps: 10 });
    } catch (e) {
        // Ignora erros de movimento (não criticos)
    }
};

// Scroll com pausas para leitura e pequenas "subidas" (Re-leitura)
const humanScroll = async (page) => {
    await page.evaluate(async () => {
        await new Promise((resolve) => {
            let totalHeight = 0;
            const distance = 100;
            const timer = setInterval(() => {
                const scrollHeight = document.body.scrollHeight;
                
                // 10% de chance de rolar um pouco para cima (simular releitura)
                const direction = Math.random() < 0.1 ? -300 : 150;
                
                window.scrollBy(0, direction);
                totalHeight += direction;

                // Para se chegar ao fim ou limite de segurança
                if (totalHeight >= scrollHeight - window.innerHeight || totalHeight > 10000) {
                    clearInterval(timer);
                    resolve();
                }
            }, 100 + Math.random() * 150); // Tempo variável entre scrolls
        });
    });
};

module.exports = {
    randomDelay,
    humanMouseMove,
    humanScroll
};