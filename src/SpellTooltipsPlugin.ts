import { Plugin } from "@highlite/plugin-api";


import blah from "../resources/html/html.html";
import styles from "../resources/css/base.css";
import img from "../resources/images/image.png";
import snd from "../resources/sounds/sound.mp3";

class ExamplePlugin extends Plugin {
    pluginName = "ExamplePlugin";
    author: string = "Your Name";

    constructor() {
        super()
    };

    init(): void {
    }

    start(): void {
        this.log("ExamplePlugin started");
        
        document.getElementById("main")!.innerHTML = blah;
    }

    stop(): void {
        this.log("ExamplePlugin stopped");
    }
}

// Export both as default and named export for maximum compatibility
export default ExamplePlugin;
export { ExamplePlugin };