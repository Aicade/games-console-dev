import { useParams } from "react-router-dom";
import { useEffect, useRef, useState } from "react";
import Phaser from "phaser";
import * as braincadeSDK from "../lib/braincadeSDK";
import { Input, Button, Checkbox } from 'antd';

const { TextArea } = Input;

const GameState = Object.freeze({
    KILLED: 0,
    ACTIVE: 1,
    MENU: 2,
    PAUSED: 3,
    ENDED: 4,
});

const ProdGame = () => {
    const { name } = useParams();
    const [gameConfig, setGameConfig] = useState({});
    const [gameState, setGameState] = useState(GameState.KILLED);
    const [game, setGame] = useState(null);
    const [gameOverDetails, setGameOverDetails] = useState({});
    const [loadError, setLoadError] = useState(null);
    const gameRef = useRef();
    gameRef.current = game;

    const [bugsList, setBugsList] = useState([]);
    const [textAreaValue, setTextAreaValue] = useState("");

    useEffect(() => {
        window.addEventListener("pauseGame", handlePauseEvent);
        window.addEventListener("gameOver", handleGameOverEvent);

        const gatherCode = async () => {
            const phaserUrl =
                "https://cdnjs.cloudflare.com/ajax/libs/phaser/3.80.1/phaser.min.js";
            const sdkUrl =
                "/lib/braincadeSDK.js";
            const vfxUrl =
                "/lib/vfxLibrary.js";
            const gameJson =
                `/config/${name}.json`
            const gameUrl =
                `/games/${name}.js`

            try {
                const phaserScript = await fetch(phaserUrl);
                const sdkScript = await fetch(sdkUrl);
                const vfxScript = await fetch(vfxUrl);
                
                // Fetch game JSON first and check if it loaded successfully
                const gameScriptJsonResponse = await fetch(gameJson);
                
                if (!gameScriptJsonResponse.ok) {
                    console.log(`Failed to load game configuration: ${gameJson}`);
                    setLoadError(`Failed to load game configuration: ${gameJson}`);
                    return "error";
                }
                
                const gameScriptJsonText = await gameScriptJsonResponse.text();
                
                // Validate that JSON is properly formed
                try {
                    JSON.parse(gameScriptJsonText);
                    console.log("Game JSON config loaded successfully:", name);
                } catch (jsonError) {
                    console.log(`Invalid JSON in game configuration: ${jsonError.message}`);
                    setLoadError(`Invalid JSON in game configuration: ${jsonError.message}`);
                    return "error";
                }
                
                // Now fetch the game script
                const gameScriptResponse = await fetch(gameUrl);
                if (!gameScriptResponse.ok) {
                    console.log(`Failed to load game script: ${gameUrl}`);
                    setLoadError(`Failed to load game script: ${gameUrl}`);
                    return "error";
                }
                
                const gameScript = await gameScriptResponse.text();

                const compiledScript =
                    (await phaserScript.text()) +
                    "\n\n" +
                    (await sdkScript.text()).replaceAll("export", "") +
                    "\n\n" +
                    (await vfxScript.text())
                        .replaceAll("export default VFXLibrary;", "")
                        .replaceAll("export", "") +
                    "\n\n" +
                    "let _CONFIG =" + gameScriptJsonText +
                    "\n\n" +
                    gameScript 
                return compiledScript;
            } catch (error) {
                console.log("Error loading game resources:", error);
                setLoadError(`Error loading game resources: ${error.message}`);
                return "error";
            }
        }

        const runCode = (code) => {
            if (code === "error") {
                return {};
            }
            
            try {
                const config = new Function(
                    code + "\n\nreturn config"
                )();
                return config;
            } catch (error) {
                console.log("Error running game code:", error);
                setLoadError(`Error running game code: ${error.message}`);
                return {}
            }
        }

        gatherCode().then((response) => {
            console.log("Code gathering complete");
            const config = runCode(response);
            
            if (Object.keys(config).length === 0) {
                console.log("Empty game configuration, game cannot start");
                return;
            }
            
            config.parent = "game-container";
            setGameConfig(config);
            setLoadError(null);
        });

        return () => {
            window.removeEventListener("pauseGame", handlePauseEvent);
            window.removeEventListener("gameOver", handleGameOverEvent);
            if (gameRef.current) gameRef.current.destroy(true, false);
        }

    }, [name]);

    const createGameInstance = () => {
        if (Object.keys(gameConfig).length === 0) {
            console.log("Cannot create game: empty configuration");
            setLoadError("Cannot create game: empty configuration");
            return;
        }
        setGame(new Phaser.Game(gameConfig));
    }

    const destroyGameInstance = () => {
        if (game) game.destroy(true, false);
        setGame(null);
    }

    const handleStartGame = () => {
        createGameInstance();
        setGameState(GameState.ACTIVE);
    }

    const handlePauseEvent = () => {
        setGameState(GameState.PAUSED);
    };

    const handleResumeGame = () => {
        setGameState(GameState.ACTIVE);
        braincadeSDK.initiateResumeGame();
    }

    const handleDestroyGame = () => {
        destroyGameInstance();
        setGameState(GameState.KILLED);
    }

    const handleRestartGame = () => {
        setGameState(GameState.ACTIVE);
        braincadeSDK.initiateRestartGame();
    }

    const handleGameOverEvent = (e) => {
        setGameState(GameState.ENDED);
        setGameOverDetails(e.detail);
    };

    const handleToggleGameSound = () => {
        braincadeSDK.initiateToggleGameSounds(false);
    }

    return (
        <div className="">
            <div className="">
                <div>
                    <div className="relative h-[95vh] m-1 border-solid border-black border-2 bg-black text-white" id="game-container">
                        {gameState == GameState.KILLED &&
                            <button onClick={handleStartGame}>Start Game</button>
                        }
                        {gameState == GameState.PAUSED && (
                            <div className="absolute top-0 flex flex-col">
                                <div>GAME PAUSED</div>
                                <button onClick={handleResumeGame}>Resume</button>
                                <button onClick={handleToggleGameSound}>Sound</button>
                                <button onClick={handleDestroyGame}>Destroy</button>
                                <button onClick={handleRestartGame}>Restart</button>
                            </div>
                        )}
                        {gameState == GameState.ENDED && (
                            <div className="absolute top-0 flex-col">
                                <div>GAME OVER</div>
                                <div>{JSON.stringify(gameOverDetails)}</div>
                                <button onClick={handleRestartGame}>Restart</button>
                                <button onClick={handleDestroyGame}>Destroy</button>
                            </div>
                        )}
                    </div>
                </div>
            </div>
            {/* <div className="flex flex-col mt-4 mx-2">
                <p className="text-4xl font-bold font-custom">CHANGES:</p>
                <TextArea rows={4} onChange={(e) => {
                    setTextAreaValue(e.target.value)
                }} />
                <Button className="my-2" type="primary" onClick={() => {
                    setBugsList(bugsList => [textAreaValue, ...bugsList]);
                }}>Add Bug</Button>
                {bugsList.map((value) => {
                    return <Checkbox>{value}</Checkbox>
                })}
            </div> */}
        </div>
    )
}
export default ProdGame;