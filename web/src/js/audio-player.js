export var Audios = {
    DO: 'do',
    KA: 'ka',
};

export class AudioPlayer {
    async init() {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        this.context = new AudioContext();
        this.soundBuffers = {};

        await this.load('/assets/audio/do.wav');
        await this.load('/assets/audio/ka.wav');
    }

    async load(url) {
        return new Promise((resolve, reject) => {
            let request = new XMLHttpRequest();
            request.open('GET', url, true);
            request.responseType = 'arraybuffer';
            request.onload = () => {
                this.context.decodeAudioData(request.response, (buffer) => {
                    let tag = this.getNameFromUrl(url);
                    this.soundBuffers[tag] = buffer;
                    resolve(tag);
                });
            };
            request.send();
        });
    }

    play(tag, time) {
        time = time | 0;
        let source = this.context.createBufferSource();
        let buffer = this.soundBuffers[tag];
        source.buffer = buffer;

        let gain = this.context.createGain();

        source.connect(gain);
        gain.connect(this.context.destination);

        source.start(time);
    }

    pause() {
        this.context.suspend();

    }

    resume() {
        this.context.resume();

    }

    getNameFromUrl(url) {
        let name = url.slice(url.lastIndexOf('/') + 1);
        return name.slice(0, name.lastIndexOf('.'));
    }

}