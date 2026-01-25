import { BaseStage } from './BaseStage.js';

/** 
 * EndRoll.js
 *
 * エンディングシーン
 */
export class EndRoll extends BaseStage {

	// *******************
	// コンストラクタ
	// *******************
	constructor() {
		super({ key: 'EndRoll' });
	}

	// *******************
	// preload
	// *******************
	preload() {
		// 画像を追加
		this.load.image('hero', 'assets/hero_right.png');
		this.load.image('konnyaku', 'assets/hero_processed.png');

		// BGMを追加
		this.load.audio('endroll', 'assets/audio/Endroll-bgm.mp3');
	}

	// *******************
	// create
	// *******************
	create(data) {
		const { width, height } = this.scale;

		// BGM再生
		this.endrollSound = this.sound.add('endroll', {
			loop: false,
			volume: 0.1,
		});
		this.endrollSound.play();

		let scrollDone = false;
		let musicDone = false;

		const maybeGoTitle = () => {
			if (scrollDone && musicDone) goTitle();
		};

		this.endrollSound.once('complete', () => {
			musicDone = true;
			maybeGoTitle();
		});

		// 背景
		this.cameras.main.setBackgroundColor('#000000');

		// エンディングテキスト
		const endingLines = [
			'こうしてコンニャクは、',
			'おでん界のセンターにおさまりました。',
			'',
			'――しかし油断はできません。',
			'',
			'新たなライバルが',
			'現れるかもしれないのですから。',
			'',
			'真のおでんの主役になるために、',
			'コンニャクの冒険はこれからも続きます。',
			'',
			'',
			'がんばれ、コンニャク！',
			'',
			'',
		];

		// --- テキスト：通常ブロック
		const normalLines = [
			'',
			'ROAD TO ODEN',
			'',
			'Game Design / Programming',
			'Minase Azusa',
			'',
			'with Phaser 3 Framework',
			'',
			'Graphics',
			'ChatGPT / Nano Banana',
			'',
			'BGM/SE',
			'DOVA-SYNDROME',
		];

		// --- テキスト：小さくしたいブロック（DOVAのURL列など）
		const smallLines = [
			'Title BGM:Endless Story(https://dova-s.jp/bgm/play13602.html)',
			'Stage1-bgm:Little(https://dova-s.jp/bgm/play23056.html)',
			'Stage2-bgm:Soldiers(https://dova-s.jp/bgm/play23060.html)',
			'Stage3-bgm:Banana Slip Rag(https://dova-s.jp/bgm/play23036.html)',
			'Stage4-bgm:和響バースト-Wakyo Burst-(https://dova-s.jp/bgm/play22594.html)',
			'Explosion SE:ポップな爆発(https://dova-s.jp/se/play480.html)',
			'Goal SE:成功した時の嬉しい音(https://dova-s.jp/se/play1368.html)',
			'Damage SE:ミスしたときの音(https://dova-s.jp/se/play469.html)',
			'Recover SE:通常回復SE(https://dova-s.jp/se/play472.html)',
			'Shot SE:8bit_Shot(https://dova-s.jp/se/play693.html)',
			'Boss Voice SE:おじさん目覚まし時計(https://dova-s.jp/se/play502.html)',
			'Endroll BGM:エンディングドライブ(https://dova-s.jp/bgm/play21992.html)',
			'',
		];

		// --- テキスト：後半通常ブロック
		const tailLines = [
			'',
			'Special Thanks',
			'ChatGPT / Gemini / Claude',
			'',
			'and YOU!',
			'',
			'Thanks for playing!',
			'',
			'',
			'このゲームは、',
			'Vibe Coding(AIコーディング)の練習のために',
			'約1ヶ月で制作したものです。',
			'',
			'おそらく不具合なども多いと思いますが、',
			'温かい目で見守っていただければ幸いです。',
			'',
			'--- Fin ---',
		];

		const endingText = this.add.text(0, 0, endingLines.join('\n'), {
			fontFamily: 'sans-serif',
			fontSize: '28px',
			color: '#ffffff',
			align: 'center',
			lineSpacing: 12,
		}).setOrigin(0.5, 0);

		const normalText = this.add.text(0, 0, normalLines.join('\n'), {
			fontFamily: 'sans-serif',
			fontSize: '28px',
			color: '#ffffff',
			align: 'center',
			lineSpacing: 12,
		}).setOrigin(0.5, 0);

		const smallText = this.add.text(0, 0, smallLines.join('\n'), {
			fontFamily: 'sans-serif',
			fontSize: '16px',      // ←ここで小さく
			color: '#ffffff',
			align: 'center',
			lineSpacing: 8,
		}).setOrigin(0.5, 0);

		const tailText = this.add.text(0, 0, tailLines.join('\n'), {
			fontFamily: 'sans-serif',
			fontSize: '28px',
			color: '#ffffff',
			align: 'center',
			lineSpacing: 12,
		}).setOrigin(0.5, 0);

		// 画像を追加
		const hero = this.add.image(0, 0, 'hero');
		hero.setOrigin(0.2, 0);
		hero.setScale(0.05);

		const konnyaku = this.add.image(0, 0, 'konnyaku');
		konnyaku.setOrigin(0.5, 0);
		konnyaku.setScale(0.05);

		// 各要素のY位置を設定
		hero.y = endingText.height + 16;
		normalText.y = hero.y + hero.displayHeight + 20;
		smallText.y = normalText.y + normalText.height + 20;
		konnyaku.y  = smallText.y + smallText.height + 20;
		tailText.y  = konnyaku.y + konnyaku.displayHeight + 20;

		const container = this.add.container(width / 2, height + 20, [
			endingText,
			hero,
			normalText,
			smallText,
			konnyaku,
			tailText
		]);

		// コンテナ全体の高さ
		const totalTextHeight = tailText.y + tailText.height;

		// スクロール距離
		const totalH = totalTextHeight + height + 80;

		// 速度
		const speed = 70;
		const duration = (totalH / speed) * 1000;

		// スキップ案内
		this.add.text(width / 2, height - 40, 'Space / Click でスキップ（Tでタイトル）', {
			fontFamily: 'monospace',
			fontSize: '16px',
			color: '#ffffff',
		}).setOrigin(0.5);

		// タイトルへ戻る（スキップ時は音を止める）
		const goTitle = () => {
			// 二重呼び出し対策
			if (this._goingTitle) return;
			this._goingTitle = true;

			// 音を止める
			if (this.endrollSound && this.endrollSound.isPlaying) {
				this.endrollSound.stop();
			}

			// tween停止（残っても問題は出にくいけど念のため）
			this.tweens.killTweensOf(container);

			this.scene.start('Title');
		};

		// 流す：完了しても即タイトルへは戻らず、音楽完了を待つ
		this.tweens.add({
			targets: container,
			y: -totalTextHeight - 60,
			duration,
			ease: 'Linear',
			onComplete: () => {
				scrollDone = true;
				maybeGoTitle();
			},
		});

		// スキップ（スキップ時は即タイトル＆音停止）
		this.input.keyboard.once('keydown-SPACE', goTitle);
		this.input.keyboard.once('keydown-T', goTitle);
		this.input.once('pointerdown', goTitle);
	}
}
