import { gameReducer } from "../../examples/alternate-screen/alternate-screen";

const boardWidth = 20;
const boardHeight = 15;
const initialSnakeLength = 3;

const snake = [];

for (let y = 0; y < boardHeight; y += 1) {
    if (y % 2 === 0) {
        for (let x = 0; x < boardWidth; x += 1) {
            if (x === 0 && y === 0) {
                continue;
            }

            snake.push({ x, y });
        }
    } else {
        for (let x = boardWidth - 1; x >= 0; x -= 1) {
            snake.push({ x, y });
        }
    }
}

const nextState = gameReducer(
    {
        food: { x: 0, y: 0 },
        frame: 42,
        gameOver: false,
        score: snake.length - initialSnakeLength,
        snake,
        won: false,
    },
    {
        direction: "left",
        type: "tick",
    },
);

console.log(
    JSON.stringify({
        gameOver: nextState.gameOver,
        score: nextState.score,
        snakeLength: nextState.snake.length,
        won: nextState.won,
    }),
);
