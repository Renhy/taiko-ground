import { Keys } from './keyboard.js';
import { httpGet } from './utils.js';

export var BeatType = {
    DO: 1,
    KA: 2,
    DAI_DO: 3,
    DAI_KA: 4,
    DRUMROLL: 5,
    DAI_DRUMROLL: 6,
    BALLOON: 7,
    END: 8,
};

export var BeatMap = {
    '1': BeatType.DO,
    '2': BeatType.KA,
    '3': BeatType.DAI_DO,
    '4': BeatType.DAI_KA,
    '5': BeatType.DRUMROLL,
    '6': BeatType.DAI_DRUMROLL,
    '7': BeatType.BALLOON,
    '8': BeatType.END,
};

export var CourseType = {
    EASY: 'Easy',
    NORMAL: 'Normal',
    HARD: 'Hard',
    EXTREME: 'Oni',
    EXTRA: 'Edit',
};

export class Music {
    async init(url) {
        let text = await httpGet(url);
        let lines = text.split('\n');

        this.metaData = {
            title: '',
            subTitle: '',
            bpm: 120,
            offset: -0.0,
            songVol: 100,
            seVol: 100,
            demoStart: 0,
        };

        this.courses = {};
        this.parse(lines);
    }

    parse(lines) {
        
        let type = '';
        let current = [];

        for (let line of lines) {
            if (!line || line.trim() == '') {
                continue;
            }

            this.parseMetadata(line);
            
            if (line.indexOf('COURSE') >= 0) {
                type = line.slice(line.indexOf(':') + 1).trim();
                current = [];
            }
            if (line.indexOf('#END') >= 0) {
                this.courses[type] = new Course(this.metaData, current);
            }

            current.push(line);
        }
    }

    parseMetadata(line) {
        if (line.indexOf('TITLE') >= 0) {
            this.metaData.title = line.slice(line.indexOf(':') + 1).trim();
        }
        if (line.indexOf('SUBTITLE') >= 0) {
            this.metaData.subTitle = line.slice(line.indexOf(':') + 1).trim();
        }
        if (line.indexOf('bpm') >= 0) {
            let bpm = line.slice(line.indexOf(':') + 1).trim();
            if (bpm.indexOf('-') >= 1) {
                bpm = bpm.slice(0, bpm.indexOf('-') - 1)
            }
            this.metaData.subTitle = parseFloat(bpm);
        }
        if (line.indexOf('OFFSET') >= 0) {
            let offset = line.slice(line.indexOf(':') + 1).trim();
            this.metaData.offset = parseFloat(offset);
        }
        if (line.indexOf('SONGVOL') >= 0) {
            let vol = line.slice(line.indexOf(':') + 1).trim();
            this.metaData.songVol = parseInt(vol);
        }
        if (line.indexOf('SEVOL') >= 0) {
            let vol = line.slice(line.indexOf(':') + 1).trim();
            this.metaData.seVol = parseInt(vol);
        }
        if (line.indexOf('DEMOSTART') >= 0) {
            let demoStart = line.slice(line.indexOf(':') + 1).trim();
            this.metaData.demoStart = parseFloat(demoStart);
        }
    }

    play(type) {
        this.currentCourse = this.courses[type];
        if (!this.currentCourse) {
            console.error('Course type not found');
        }
        this.currentCourse.play();
    }

    beat(key) {
        this.currentCourse.beat(key);

    }

    readState(deltaTime) {
        return this.currentCourse.readState(deltaTime);
    }


}

class Course {
    constructor(metaData, lines) {
        this.metaData = metaData;
        // parse course informations
        let startIndex = 0;
        for (let i = 0; i < lines.length; i++) {
            let line = lines[i];
            if (line.indexOf('COURSE') >= 0) {
                this.type = line.slice(line.indexOf(':') + 1).trim();
            }
            if (line.indexOf('LEVEL') >= 0) {
                this.level = parseInt(line.slice(line.indexOf(':') + 1).trim());
            }
            if (line.indexOf('BALLOON') >= 0) {
                let str = line.slice(line.indexOf(':') + 1).trim();
                if (str != '') {
                    this.balloonCounts = [];
                    this.balloonCountIndex = 0;
                    for (let count of str.split(',')) {
                        this.balloonCounts.push(parseInt(count.trim()));
                    }
                }
            }

            if (line.indexOf('#START') >= 0) {
                startIndex = i;
                break;
            }
        }

        // parse measure and beat
        this.measures = [];
        this.beats = [];

        let cachedCommands = [];
        let cachedCommandsData = {};

        let bpm = metaData.bpm;
        let timePerMeasure = 4 * 60 * 1000 / bpm;
        let currentTime = metaData.offset * -1000;
        for (let i = startIndex; i < lines.length; i ++) {
            let line = lines[i];
            if (line.trim() == '') {
                continue;
            }

            // handle command
            if (line.indexOf('#') >= 0) {
                line = line.slice(line.indexOf('#') + 1).trim();

                continue;
            }

            // handle measure
            line = line.slice(0, line.indexOf(',')).trim();
            let measure = {
                start: currentTime,
                duration: timePerMeasure,
                commands: cachedCommands,
                commandsData : cachedCommandsData,
            };
            this.measures.push(measure);
            cachedCommands = []
            cachedCommandsData = [];
            if (line.length == 0) {
                currentTime += timePerMeasure;
                continue
            }

            // handle beat
            let beatCount = line.length;
            let timePerBeat = measure.duration / beatCount;
            for (let b of line) {
                if (BeatMap[b]) {
                    let beat = {
                        ts: currentTime,
                        value: BeatMap[b],
                    };
                    this.beats.push(beat);
                }

                currentTime += timePerBeat;
            }
        }
    }

    play() {
        this.state = {
            index: {
                measure: 0,
                beat: 0,
                balloon: 0,
            },
            beat: {
                leftDo: 0,
                rightDo: 0,
                leftKa: 0,
                rightKa: 0,
            },
            play: {
                combo: 0,
                gogoTime: false,
                balloon: true,
                drumroll: false,
                daiDrumroll: false,
                count: 0,
            },
        };

        this.records = [];
    }

    beat(key) {
        this.records.push(key);
        switch (key.value) {
            case Keys.LEFT_DO:
                this.state.beat.leftDo = key.ts;
                break;
            case Keys.RIGHT_DO:
                this.state.beat.rightDo = key.ts;
                break;
            case Keys.LEFT_KA:
                this.state.beat.leftKa = key.ts;
                break;
            case Keys.RIGHT_KA:
                this.state.beat.rightKa = key.ts;
                break;
        }
    }

    readState(deltaTime) {
        this.checkBeat(deltaTime);

        let result = {
            beat: this.state.beat,
            play: this.state.play,

            beats: [],
        };

        let lastTs = deltaTime + this.measures[this.state.index.measure].duration;
        for (let i = this.state.index.beat; i < this.beats.size(); i++) {
            if (this.beats[i].ts > lastTs) {
                break;
            }

            let beat = {
                distance: (this.beats[i] - delatTime) / this.measures[this.state.index.measure].duration,
                type: this.beats[i].type
            };

            result.beats.push(beat);
        }

        return result;
    }

    checkBeat(deltaTime) {

    }



}
