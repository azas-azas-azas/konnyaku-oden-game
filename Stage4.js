// Stage4.js（整理版）
// - スペース：黒い弾を発射（雑魚は1発、ボスは20発で撃破）
// - 3段ジャンプ
// - ちくわ：右半分ランダムXから落下＋左流れ（たまに2連）
// - 卵：右側ランダムからプレイヤーめがけて飛来（壁・地面で反射）
// - 牛すじ：チュートリアル（動きはそのまま・量を増やす）
// - きんちゃく（mochi）：現状維持
export class Stage4 extends Phaser.Scene {
	constructor() {
		super({ key: 'Stage4' });

		// ここでは定数っぽいものだけ置く（restartでconstructorは呼ばれないため）
		this.stageDuration = 60000;
		this.maxHp = 100;
		this.maxJumps = 3;

		// ボス
		this.bossHpMax = 20;
	}

	// scene.restart() 対策：毎回ここで状態を初期化
	init() {
		// HP
		this.hp = this.maxHp;
		this.invincibleUntil = 0;

		// フェーズ
		this.phase = 'gyusuji';
		this.bossSpawned = false;
		this.goalOpened = false;

		// ジャンプ
		this.jumpCount = 0;

		// ボス制御
		this.boss = null;
		this.bossHp = this.bossHpMax;
		this.bossPauseDone = false;
		this.bossResumeEvent = null;

		// シューティング
		this.lastShotAt = 0;

		// イベント参照
		this.spawnEvent = null;
		this.bossSkillEvent = null;
	}

	preload() {
		this.load.image('hero', 'assets/hero_processed.png');

		this.load.image('chikuwa', 'assets/chikuwa.png');
		this.load.image('mochi', 'assets/mochi.png');
		this.load.image('gyusuji', 'assets/gyusuji.png');
		this.load.image('daikon', 'assets/daikon_boss.png');

		// 卵は3種類
		this.load.image('egg1', 'assets/egg1.png');
		this.load.image('egg2', 'assets/egg2.png');
		this.load.image('egg3', 'assets/egg3.png');

		// 鍋
		this.load.image('pot', 'assets/pot.png');
	}

	create() {
		const { width, height } = this.scale;

		// 背景
		this.add.rectangle(width / 2, height / 2, width, height, 0x87ceeb).setDepth(-10);

		// 鍋っぽい雰囲気（下部を暗く）
		this.add.rectangle(width / 2, height - 60, width, 180, 0x2b2b2b).setAlpha(0.35);

		// テクスチャ生成（図形）
		this.makeTextures();

		// 地面（鍋のフチ）
		this.ground = this.physics.add.staticImage(width / 2, height - 50, 'ground');
		this.ground.refreshBody();

		// プレイヤー
		this.player = this.physics.add.image(140, height - 150, 'hero');
		this.player.setScale(0.05);
		this.player.setOrigin(0.5, 1);
		this.player.setDepth(20); // 鍋より前
		this.player.body.setSize(this.player.width, this.player.height);

		this.player.setCollideWorldBounds(true);
		this.player.setBounce(0);

		this.physics.add.collider(this.player, this.ground);

		// 障害物（雑魚）グループ
		this.obstacles = this.physics.add.group({
			collideWorldBounds: false,
			allowGravity: true,
		});

		this.physics.add.collider(this.obstacles, this.ground);
		this.physics.add.overlap(this.player, this.obstacles, (player, obs) => {
			this.hitObstacle(obs);
		});

		// 弾（ショット）グループ
		this.bullets = this.physics.add.group({
			allowGravity: false,
		});

// 弾 × 雑魚
this.physics.add.overlap(this.bullets, this.obstacles, (bullet, enemy) => {
  if (!bullet || !bullet.active) return;
  if (!enemy || !enemy.active) return;

  if (enemy === this.boss) return; // ★保険

  bullet.disableBody(true, true);
  enemy.destroy();
});
       
		// 卵のバウンド回数を監視して一定回数で消す
		this.physics.world.on('worldbounds', (body) => {
			const obj = body.gameObject;
			if (!obj || !obj.active) return;
			if (obj.getData('type') !== 'egg') return;

			const bounced = (obj.getData('bounces') || 0) + 1;
			if (bounced >= 2) {
				obj.destroy();
			} else {
				obj.setData('bounces', bounced);
			}
		});

		// 入力
		this.cursors = this.input.keyboard.createCursorKeys();
		this.spaceKey = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.SPACE);

		// UI
		this.uiText = this.add.text(16, 12, '', {
			fontFamily: 'monospace',
			fontSize: '16px',
			color: '#0b1b2b',
		});

		this.messageText = this.add.text(width / 2, 60, '', {
			fontFamily: 'sans-serif',
			fontSize: '22px',
			color: '#ffffff',
			stroke: '#000000',
			strokeThickness: 5,
		}).setOrigin(0.5).setDepth(150);

		// --- ボスHPゲージ（最初は非表示） ---
		const barX = 16;
		const barY = 40;
		this.bossBarW = 220;
		const barH = 10;

		this.bossHpBg = this.add.rectangle(barX, barY, this.bossBarW, barH, 0x000000)
			.setOrigin(0, 0.5)
			.setDepth(200)
			.setVisible(false);

		this.bossHpBar = this.add.rectangle(barX, barY, this.bossBarW, barH, 0xff4444)
			.setOrigin(0, 0.5)
			.setDepth(201)
			.setVisible(false);

		this.bossHpLabel = this.add.text(barX + this.bossBarW + 8, barY - 8, 'daikon', {
			fontFamily: 'monospace',
			fontSize: '12px',
			color: '#0b1b2b',
		}).setDepth(202).setVisible(false);

		// タイマー開始
		this.startTime = this.time.now;

		// 一定間隔でスポーン（フェーズで中身を切り替える）
		this.spawnEvent = this.time.addEvent({
			delay: 900,
			loop: true,
			callback: () => this.spawnByPhase(),
		});

		// 進行管理（軽めに頻繁チェック）
		this.time.addEvent({
			delay: 200,
			loop: true,
			callback: () => this.updatePhaseAndBoss(),
		});

		// ゴール（最初は非表示）
		this.goalZone = this.physics.add.staticImage(width - 120, height - 210, 'pot');
		this.goalZone.setScale(0.5);
		this.goalZone.setVisible(false);
		this.goalZone.setDepth(2); // 鍋は奥
		this.goalZone.body.enable = false;

		this.goalZone.body.setSize(
			this.goalZone.displayWidth * 0.45,
			this.goalZone.displayHeight * 0.25,
			true
		);

		this.goalZone.body.setOffset(
			this.goalZone.body.offset.x,
			this.goalZone.body.offset.y + this.goalZone.displayHeight * 0.15
		);

		this.physics.add.overlap(this.player, this.goalZone, () => {
			if (!this.goalOpened) return;
			this.clearStage();
		});

		// ワールド外に落ちたらゲームオーバー（鍋に落下＝失敗）
		this.fallLimitY = height + 80;

		// 開始メッセージ
		this.messageText.setText('Stage4：先輩具材の試練');

		// デバッグ表示（必要ならtrue/falseで切り替え）
		// this.physics.world.createDebugGraphic();
	}

	update() {
		const { width, height } = this.scale;

		// 左右移動
		const speed = 260;
		if (this.cursors.left.isDown) {
			this.player.setVelocityX(-speed);
		} else if (this.cursors.right.isDown) {
			this.player.setVelocityX(speed);
		} else {
			this.player.setVelocityX(0);
		}

		// 3段ジャンプ（押した瞬間だけ）
		if (this.player.body.blocked.down) {
			this.jumpCount = 0;
		}
		if (Phaser.Input.Keyboard.JustDown(this.cursors.up)) {
			if (this.player.body.blocked.down || this.jumpCount < this.maxJumps) {
				this.player.setVelocityY(-520);
				this.jumpCount++;
			}
		}

		// ショット（スペース）
		if (Phaser.Input.Keyboard.JustDown(this.spaceKey)) {
			this.shootBullet();
		}

		// ボス：全身が見えたら停止 → 再始動
		if (this.boss && this.boss.active && !this.bossPauseDone && !this.goalOpened) {
			const bounds = this.boss.getBounds();
			if (bounds.right <= width - 120) { // ここを小さくすると右寄り、大きくすると左寄り
				this.bossPauseDone = true;
				this.boss.setVelocityX(0);

				this.bossResumeEvent = this.time.delayedCall(1200, () => {
					if (this.boss && this.boss.active && !this.goalOpened) {
						this.boss.setVelocityX(-140);
					}
				});
			}
		}

		// UI更新
		const elapsed = this.time.now - this.startTime;
		const remain = Math.max(0, Math.ceil((this.stageDuration - elapsed) / 1000));
		this.uiText.setText(
			`TIME: ${remain}s   PHASE: ${this.phase}`
		);

		// 落下死
		if (this.player.y > this.fallLimitY) {
			this.gameOver('鍋に落ちた…！');
		}

		// 画面外の障害物を掃除
		this.obstacles.getChildren().forEach((o) => {
			if (!o.active) return;
			if (o.x < -200 || o.x > width + 200 || o.y > height + 300 || o.y < -250) {
				o.destroy();
			}
		});

		// 画面外の弾を掃除
		this.bullets.getChildren().forEach((b) => {
			if (!b.active) return;
			if (b.x > width + 60 || b.x < -60 || b.y < -60 || b.y > height + 60) {
				b.destroy();
			}
		});
	}

	// -------------------------
	// テクスチャ生成
	// -------------------------
	makeTextures() {
		if (this.textures.exists('ground')) return;

		const g = this.add.graphics();

		// ground
		g.clear();
		g.fillStyle(0x6b4f2a, 1);
		g.fillRect(0, 0, 820, 40);
		g.generateTexture('ground', 820, 40);

		// bullet（8x8の黒丸）
		g.clear();
		g.fillStyle(0x000000, 1);
		g.fillCircle(4, 4, 4);
		g.generateTexture('bullet', 8, 8);

		g.destroy();
	}

	// -------------------------
	// フェーズ制御
	// -------------------------
	updatePhaseAndBoss() {
		const elapsed = this.time.now - this.startTime;

		if (elapsed < 10000) this.phase = 'gyusuji';
		else if (elapsed < 22000) this.phase = 'chikuwa';
		else if (elapsed < 35000) this.phase = 'mochi';
		else if (elapsed < 48000) this.phase = 'egg';
		else this.phase = 'daikon';

		// ボス召喚（1回だけ）
		if (this.phase === 'daikon' && !this.bossSpawned) {
			this.bossSpawned = true;

			// 既存の雑魚を一掃（特定の種類だけ残したいなら type で絞る）
//			this.obstacles.getChildren().forEach(o => {
//				if (o && o.active) o.destroy();
//			});

			this.spawnDaikonBoss();
			this.messageText.setText('大根「覚悟はできたか？」'); // 消さない（ボスが消えるまで表示）
		}

// ステージ時間終了 → ゴール出現
if (!this.goalOpened && elapsed >= this.stageDuration) {
  const bossAlive =
    this.phase === 'daikon' &&
    this.boss && this.boss.active &&
    this.bossHp > 0;

  // ★ボスが生きてるなら時間切れ処理を止める
  if (!bossAlive) {
    this.openGoal();
  }
}


	}

	spawnByPhase() {
		// ゴールが開いた後は、敵スポーンを止める
		if (this.goalOpened) return;

		switch (this.phase) {
			case 'gyusuji':
				// チュートリアル：動きはそのまま、量を増やす
				this.spawnGyusuji();
				if (Phaser.Math.Between(0, 100) < 75) this.spawnGyusuji(); // ほぼ2体
				if (Phaser.Math.Between(0, 100) < 35) this.spawnGyusuji(); // たまに3体
				break;

			case 'chikuwa':
				this.spawnChikuwa();
				break;

			case 'mochi':
				this.spawnMochi();
				break;

			case 'egg':
				this.spawnEgg();
				break;

			case 'daikon':
				// ボス戦中は雑魚を出さない（画面崩壊＆理不尽防止）
				break;
		}
	}

	// -------------------------
	// 敵スポーン
	// -------------------------
	spawnGyusuji() {
		const { width, height } = this.scale;
		const o = this.obstacles.create(width + 40, height - 120, 'gyusuji')
			.setScale(0.08)
			.setOrigin(0.5, 1);
		o.setData('type', 'gyusuji');
		o.setVelocityX(-180);
	}

	// ちくわ：右半分ランダムXから落下＋左へ流れる（たまに2連）
	spawnChikuwa() {
		const { width } = this.scale;

		const spawnOne = (delay = 0) => {
			this.time.delayedCall(delay, () => {
				if (this.goalOpened) return;

				const xMin = Math.floor(width * 0.55);
				const xMax = width + 40;
				const x = Phaser.Math.Between(xMin, xMax);

				const y = Phaser.Math.Between(-140, 20);

				const o = this.obstacles.create(x, y, 'chikuwa')
					.setScale(0.12)
					.setOrigin(0.5, 0.5);

				o.setData('type', 'chikuwa');
				o.body.setAllowGravity(true);

				o.setVelocityX(Phaser.Math.Between(-260, -180));
				o.setVelocityY(Phaser.Math.Between(60, 160));
				o.setBounce(0.2);
			});
		};

		spawnOne();

		// 30%で2連
		if (Phaser.Math.Between(0, 100) < 30) {
			spawnOne(120);
		}
	}

	// きんちゃく（mochi）：現状維持
	spawnMochi() {
		const { width } = this.scale;
		const x = Phaser.Math.Between(this.player.x + 120, width + 40);
		const o = this.obstacles.create(x, -40, 'mochi')
			.setScale(0.1);
		o.setData('type', 'mochi');
		o.setVelocityX(-120);
		o.setBounce(0.6);
	}

	// 卵：右側ランダム位置からプレイヤーを狙って飛来（壁・地面で反射）
	spawnEgg() {
		const { width, height } = this.scale;

		const eggKeys = ['egg1', 'egg2', 'egg3'];
		const key = Phaser.Utils.Array.GetRandom(eggKeys);

		// 右側（画面内～少し外）から
		const x = Phaser.Math.Between(Math.floor(width * 0.6), width + 40);
		const y = Phaser.Math.Between(60, height - 260);

		const egg = this.obstacles.create(x, y, key)
			.setScale(0.2)
			.setOrigin(0.5, 0.5);

		egg.setData('type', 'egg');
		egg.setData('bounces', 0);

		// 直進弾っぽくする
		egg.body.setAllowGravity(false);

		// ワールド境界で反射
		egg.setCollideWorldBounds(true);
		egg.setBounce(1);
		egg.body.onWorldBounds = true;

		// 方向：プレイヤーへ（たまに横寄りにする）
		const targetX = this.player.x;
		const targetY = this.player.y - 40;

		let dx = targetX - x;
		let dy = targetY - y;

		// 横寄り（ジャンプで抜けやすい/撃ちやすい）を少し混ぜる
		if (Phaser.Math.Between(0, 100) < 35) {
			dy = Phaser.Math.Between(-50, 50);
		}

		const len = Math.max(1, Math.hypot(dx, dy));
		dx /= len;
		dy /= len;

		const speed = Phaser.Math.Between(260, 340);
		egg.setVelocity(dx * speed, dy * speed);
	}

	// ボス
	spawnDaikonBoss() {
		const { width, height } = this.scale;

		this.boss = this.physics.add.image(width + 80, height - 200, 'daikon');
		this.boss.setDepth(10); // ★鍋(2)より前に出す
		this.boss.setOrigin(0.5, 1);
		this.boss.setScale(0.5);
		this.boss.body.setSize(this.boss.width * 0.8, this.boss.height * 0.8);
		this.boss.setData('type', 'daikon');

this.boss.once('destroy', () => {
  console.log('[boss destroyed]');
});		

		// 入場：まず左へ動く（全身が入ったところでupdate内で停止）
		this.boss.setVelocityX(-140);

		this.physics.add.collider(this.boss, this.ground);


		// ボスHP（20発）＆ゲージ表示
		this.bossHpMax = 20;
		this.bossHp = this.bossHpMax;
		this.bossPauseDone = false;

		this.bossHpBg.setVisible(true);
		this.bossHpBar.setVisible(true);
		this.bossHpLabel.setVisible(true);
		this.updateBossHpBar();

		// プレイヤー接触ダメージ
		this.physics.add.overlap(this.player, this.boss, () => {
			this.hitObstacle(this.boss);
		});

// 弾 × ボス
this.physics.add.overlap(this.bullets, this.boss, (bullet, boss) => {
    // ログ確認用
    // console.log('Bullet hit boss overlap detected');

    if (!bullet || !bullet.active) return;
    if (!boss || !boss.active) return;
    
    // 多重ヒット防止（1発の弾で連続ダメージが入らないようにする）
    if (bullet.getData('hitBoss')) return;

    console.log('Boss hit by bullet');

    // ヒット済みフラグを立てる
    bullet.setData('hitBoss', true);

    // 【変更】destroy() ではなく disableBody で安全に消す
    bullet.disableBody(true, true);

    // ダメージ処理
    this.damageBoss(boss);
});
	}

	// -------------------------
	// シューティング
	// -------------------------
shootBullet() {
  const now = this.time.now;
  if (now - this.lastShotAt < 150) return;
  this.lastShotAt = now;

  const bullet = this.bullets.get(this.player.x + 20, this.player.y - 30, 'bullet');
  if (!bullet) return;

  bullet.setActive(true).setVisible(true);
  bullet.body.enable = true;

  bullet.setDepth(30);
  bullet.body.setAllowGravity(false);
  bullet.setVelocityX(600);
}

	// -------------------------
	// ボスHP
	// -------------------------
	updateBossHpBar() {
		if (!this.bossHpBar) return;
		const ratio = Phaser.Math.Clamp(this.bossHp / this.bossHpMax, 0, 1);
		this.bossHpBar.width = this.bossBarW * ratio;
	}

damageBoss(boss) {
  if (!boss || !boss.active) return;

  console.log('Boss hit! HP:', this.bossHp - 1);

  this.bossHp--;
  this.updateBossHpBar();

  boss.setTint(0xffaaaa);
  this.time.delayedCall(60, () => {
    if (boss && boss.active) boss.clearTint();
  });

  if (this.bossHp <= 0) {
    boss.destroy();
    if (this.boss === boss) this.boss = null; // ★参照も整理

    this.bossHpBg.setVisible(false);
    this.bossHpBar.setVisible(false);
    this.bossHpLabel.setVisible(false);

    if (this.messageText) this.messageText.setText('');
//    this.openGoal();
  }else {
	console.log('Boss HP remaining:', this.bossHp);
  }
}

	// -------------------------
	// ダメージ処理（被弾回数制にしたい場合はここで切り替え可能）
	// -------------------------
	hitObstacle(obs) {
		const now = this.time.now;
		if (now < this.invincibleUntil) return;

		// いまはダメージ値を0にしてある（必要なら復活させてOK）
		const type = obs && obs.getData ? (obs.getData('type') || '') : '';
		let dmg = 0;

		/*
		switch (type) {
			case 'gyusuji': dmg = 14; break;
			case 'chikuwa': dmg = 12; break;
			case 'mochi':   dmg = 16; break;
			case 'egg':     dmg = 6;  break;
			case 'daikon':  dmg = 24; break;
		}
		*/

		this.hp -= dmg;
		this.invincibleUntil = now + 600;

		// ひるみ＆点滅
		this.player.setTint(0xff6666);
		this.time.delayedCall(120, () => this.player.clearTint());
		this.cameras.main.shake(80, 0.004);

		if (this.hp <= 0) {
			this.gameOver('煮込まれる前に力尽きた…');
		}
	}

	// -------------------------
	// ゴール解放（鍋へジャンプ）
	// -------------------------
	openGoal() {
console.log('[openGoal] called. phase=', this.phase, 'bossActive=', this.boss?.active, 'bossHp=', this.bossHp);

		this.goalOpened = true;

		// 敵の追加を止める
		if (this.spawnEvent) this.spawnEvent.remove(false);

		// ボスが残ってたら退場
		if (this.boss && this.boss.active) {
			this.boss.destroy();
		}
		if (this.bossResumeEvent) {
			this.bossResumeEvent.remove(false);
		}

		// ゲージ非表示（時間切れルートの保険）
		if (this.bossHpBg) this.bossHpBg.setVisible(false);
		if (this.bossHpBar) this.bossHpBar.setVisible(false);
		if (this.bossHpLabel) this.bossHpLabel.setVisible(false);

		// セリフ切り替え
		if (this.messageText) this.messageText.setText('鍋へジャンプ！');

		// 鍋表示
		this.goalZone.setVisible(true);
		this.goalZone.body.enable = true;
	}

	// -------------------------
	// クリア / ゲームオーバー
	// -------------------------
	clearStage() {
		// 連打防止
		this.goalOpened = false;

		this.physics.pause();
		this.player.setVelocity(0, 0);
		this.player.setDepth(20); // 最前面維持

		const { width, height } = this.scale;
		this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.45).setDepth(90);

		const clearText = this.add.text(
			width / 2,
			height / 2 - 30,
			'クリア！\nこうして、立派なおでんになりました',
			{
				fontFamily: 'sans-serif',
				fontSize: '26px',
				color: '#ffffff',
				align: 'center',
				stroke: '#000000',
				strokeThickness: 6,
			}
		).setOrigin(0.5).setDepth(100);

		const restartText = this.add.text(
			width / 2,
			height / 2 + 60,
			'R：リスタート',
			{
				fontFamily: 'monospace',
				fontSize: '18px',
				color: '#ffffff',
			}
		).setOrigin(0.5).setDepth(100);

		const keyR = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);
		keyR.once('down', () => this.scene.restart());
	}

	gameOver(msg) {
		this.physics.pause();

		const { width, height } = this.scale;
		this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.45).setDepth(90);

		const overText = this.add.text(
			width / 2,
			height / 2 - 20,
			`ゲームオーバー\n${msg}`,
			{
				fontFamily: 'sans-serif',
				fontSize: '26px',
				color: '#ffffff',
				align: 'center',
				stroke: '#000000',
				strokeThickness: 6,
			}
		).setOrigin(0.5).setDepth(100);

		const restartText = this.add.text(
			width / 2,
			height / 2 + 60,
			'R：リスタート',
			{
				fontFamily: 'monospace',
				fontSize: '18px',
				color: '#ffffff',
			}
		).setOrigin(0.5).setDepth(100);

		const keyR = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);
		keyR.once('down', () => this.scene.restart());
	}
}
