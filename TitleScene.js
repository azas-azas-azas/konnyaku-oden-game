// TitleScene.js
export class TitleScene extends Phaser.Scene {
	constructor() {
		super({ key: 'Title' });
	}

	create() {
		// TitleScene の create() 内イメージ
		this.add.text(400, 140, 'ROAD TO ODEN', { 
            fontFamily: 'sans-serif', // フォントはお好みで
            fontSize: '64px',       // 英語タイトルなので少し大きくしてもかっこいいです
            color: '#a89393',
            fontStyle: 'bold'       // 太字にするとタイトルっぽくなります
        }).setOrigin(0.5);
		const makeBtn = (y, label, sceneKey) => {
			const t = this.add.text(400, y, label, { fontSize: '28px', color: '#000', backgroundColor: '#fff' })
				.setOrigin(0.5)
				.setPadding(10)
				.setInteractive({ useHandCursor: true });

			t.on('pointerdown', () => this.scene.start(sceneKey));
		};

		makeBtn(260, 'START（Stage1）', 'Stage1');
		makeBtn(320, 'Stage2から', 'Stage2');
		makeBtn(380, 'Stage3から', 'Stage3');
		makeBtn(440, 'Stage4から', 'Stage4');

		// 数字キーでも面セレクト
		this.input.keyboard.on('keydown-ONE',  () => this.scene.start('Stage1'));
		this.input.keyboard.on('keydown-TWO',  () => this.scene.start('Stage2'));
		this.input.keyboard.on('keydown-THREE',() => this.scene.start('Stage3'));
		this.input.keyboard.on('keydown-FOUR', () => this.scene.start('Stage4'));
	}

	makeButton(x, y, label, onClick, fontSize = 28) {
		const t = this.add.text(x, y, label, {
			fontFamily: 'monospace',
			fontSize: `${fontSize}px`,
			color: '#ffffff',
			backgroundColor: 'rgba(0,0,0,0.35)',
			padding: { left: 16, right: 16, top: 10, bottom: 10 },
		}).setOrigin(0.5).setInteractive({ useHandCursor: true });

		t.on('pointerover', () => t.setStyle({ backgroundColor: 'rgba(255,255,255,0.15)' }));
		t.on('pointerout', () => t.setStyle({ backgroundColor: 'rgba(0,0,0,0.35)' }));
		t.on('pointerdown', onClick);

		return t;
	}
}
