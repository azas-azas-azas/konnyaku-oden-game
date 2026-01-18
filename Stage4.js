// Stage4.js（ダイコンボス完全削除版）
// - スペース：黒い弾を発射（雑魚は1発で消える）
// - 3段ジャンプ
// - ちくわ：右半分ランダムXから落下＋左流れ（たまに2連）
// - 卵：右側ランダムからプレイヤーめがけて飛来（壁・地面で反射）
// - 牛すじ：チュートリアル（動きはそのまま・量を増やす）
// - きんちゃく（mochi）：現状維持
// - ステージ時間終了で鍋（ゴール）出現（ボス戦なし）

export class Stage4 extends Phaser.Scene {
	constructor() {
		super({ key: 'Stage4' });

		// restartでconstructorは呼ばれないため、定数っぽいものだけ置く
		this.stageDuration = 60000;
		this.maxHp = 100;
		this.maxJumps = 3;
	}

	// scene.restart() 対策：毎回ここで状態を初期化
	init() {
		// HP（3回当たったらアウト）
		this.maxHp = 2;
		this.hp = this.maxHp;
		this.invincibleUntil = 0;

		// ★デバッグ用：ここを true にすると無敵になります
		this.isDebugInvincible = false;

		// ボス管理用
		this.boss = null;

		// ボスが出現済みかどうかを管理するフラグ
		this.bossSpawned = false;

		// フェーズ
		this.phase = 'gyusuji';
		this.goalOpened = false;

		// ジャンプ
		this.jumpCount = 0;

		// シューティング
		this.lastShotAt = 0;

		// イベント参照
		this.spawnEvent = null;

		// ゲームオーバーフラグ（多重呼び出し防止）
		this.isGameOver = false;
	}

	preload() {
		this.load.image('hero', 'assets/hero_processed.png');

		this.load.image('chikuwa', 'assets/chikuwa.png');
		this.load.image('mochi', 'assets/mochi.png');
		this.load.image('gyusuji', 'assets/gyusuji.png');

		// 卵は3種類
		this.load.image('egg1', 'assets/egg1.png');
		this.load.image('egg2', 'assets/egg2.png');
		this.load.image('egg3', 'assets/egg3.png');

		// ダイコンボス
		this.load.image('daikon_boss', 'assets/daikon_boss.png');
		
		// 鍋（ゴール）
		this.load.image('pot', 'assets/pot.png');
	}

	create() {
		this.showStageBanner('Stage4：先輩具材の試練');

		// 青空っぽい色
		this.cameras.main.setBackgroundColor('#87ceeb');

		// 操作説明表示
		this.showControls('←→ 移動 / R リスタート / T タイトル　【おでん鍋を目指せ！】');

		// 共通キー設定
		this.setupCommonKeys();

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
		this.player.setGravityY(1000);

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

		// 弾 × 雑魚（1発で消える）
		this.physics.add.overlap(this.bullets, this.obstacles, (bullet, enemy) => {
			if (!bullet || !bullet.active) return;
			if (!enemy || !enemy.active) return;

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

		// タイマー開始
		this.startTime = this.time.now;

		// 一定間隔でスポーン（フェーズで中身を切り替える）
		this.spawnEvent = this.time.addEvent({
			delay: 900,
			loop: true,
			callback: () => this.spawnByPhase(),
		});

		// 進行管理（軽めに頻繁チェック）
		this.phaseEvent = this.time.addEvent({
			delay: 200,
			loop: true,
			callback: () => this.updatePhaseAndGoal(),
		});		

		// --- 鍋（表示用） ---
		this.pot = this.add.image(width - 120, height - 210, 'pot');
		this.pot.setScale(0.5);
		this.pot.setVisible(false);
		this.pot.setDepth(2); // 鍋は奥

		// --- 鍋の「中だけ」に当たり判定（見えないZone） ---
		
		// 先にサイズと位置を計算してしまう
		const zoneW = this.pot.displayWidth * 0.32;
		const zoneH = this.pot.displayHeight * 0.10;

		// 鍋の「口」あたりに来るように計算
		const zoneX = this.pot.x + this.pot.displayWidth * 0.02;
		const zoneY = this.pot.y - this.pot.displayHeight * 0.35;

		// 計算した位置(zoneX, zoneY)とサイズ(zoneW, zoneH)を指定して生成する
		this.goalZone = this.add.zone(zoneX, zoneY, zoneW, zoneH);
		
		// Static Bodyとして物理演算に追加
		this.physics.add.existing(this.goalZone, true);
		
		this.goalZone.setVisible(false);

		// 「中に入ったら」判定
		this.physics.add.overlap(this.player, this.goalZone, (player, zone) => {

		if (!this.goalOpened) return;

			// 触れただけ防止：ゾーンの中心(y)より「少し上」あたりで反応するように調整
			const needSinkY = zone.y - (zone.body.height * 0.2);
			if (player.body.bottom < needSinkY) return;

			this.clearStage();
		});

		// ワールド外に落ちたらゲームオーバー（鍋に落下＝失敗）
		this.fallLimitY = height + 80;

		// 説明テキスト
		this.infoText = this.add.text(
			20,
			50,
			'↑でジャンプ（3段ジャンプまで可）。Spaceで弾発射！',
			{ fontSize: '16px', color: '#000' , padding: { top: 6, bottom: 2 }}
		 );

		// デバッグ表示（必要ならtrue/falseで切り替え）
//		this.physics.world.createDebugGraphic();
	}

	update() {
		// 共通キー更新
		this.updateCommonKeys();

		// ゲームオーバーなら更新処理を一切しない
		if (this.isGameOver) return;

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

		// UI更新
		const elapsed = this.time.now - this.startTime;
		const remain = Math.max(0, Math.ceil((this.stageDuration - elapsed) / 1000));
//		this.uiText.setText(`TIME: ${remain}s   PHASE: ${this.phase}`);

//		// 落下死
//		if (this.player.y > this.fallLimitY) {
//			this.gameOver('鍋に落ちた…！');
//		}

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

		// ボスの弾（白い粒：大根おろし）
		g.clear();
		g.fillStyle(0xffffff, 1); // 白
		g.fillCircle(6, 6, 6);    // 少し大きめの丸
		g.generateTexture('bossBullet', 12, 12);

		g.destroy();
	}

	// -------------------------
	// フェーズ制御
	// -------------------------
	updatePhaseAndGoal() {
		const elapsed = this.time.now - this.startTime;

		if (elapsed < 10000) this.phase = 'gyusuji';
		else if (elapsed < 22000) this.phase = 'chikuwa';
		else if (elapsed < 35000) this.phase = 'mochi';
		else if (elapsed < 48000) this.phase = 'egg';
		else {
			this.phase = 'daikon';

			// ボスがまだいなければ出現させる（1回だけ実行）
			if (!this.bossSpawned) {
				this.spawnBoss();
			}
		}

		// --- ゴール出現判定 ---
		// 60秒（stageDuration）経ったらゴールを開く
		if (!this.goalOpened && elapsed >= this.stageDuration) {
			this.openGoal();
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
		}
	}

	// -------------------------
	// 敵スポーン
	// -------------------------
	spawnGyusuji() {
		const { width, height } = this.scale;
		const o = this.obstacles.create(width + 40, height - 70, 'gyusuji')
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
				o.setGravityY(600);

				o.setVelocityX(Phaser.Math.Between(-120, -60));
				o.setVelocityY(Phaser.Math.Between(50, 100));
				o.setBounce(0.2);
			});
		};

		spawnOne();

		// 30%で2連
		if (Phaser.Math.Between(0, 100) < 30) {
			spawnOne(120);
		}
	}

	// きんちゃく（mochi）
	spawnMochi() {
		const { width } = this.scale;
		const x = Phaser.Math.Between(this.player.x + 120, width + 40);
		const o = this.obstacles.create(x, -40, 'mochi')
			.setScale(0.1);
		o.setData('type', 'mochi');

		o.body.setAllowGravity(true);
		o.setGravityY(500);

		o.setVelocityX(-120);
		o.setBounce(0.6);
	}

	// 卵：右側ランダム位置からプレイヤーを狙って飛来（壁・地面で反射）
	spawnEgg() {
		const { width, height } = this.scale;

		const eggKeys = ['egg1', 'egg2', 'egg3'];
		const key = Phaser.Utils.Array.GetRandom(eggKeys);

		// 右側（画面内～少し外）から
		const x = width - 50;
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

	// -------------------------
	// ボス出現（演出のみ・ダメージなし）
	// -------------------------
	spawnBoss() {
		// 出現済みフラグを立てる
		this.bossSpawned = true;

		// ★ここで無敵モードを自動解除！
//		this.isDebugInvincible = false;

		const { width, height } = this.scale;

		// --- 基本設定 ---
		this.boss = this.physics.add.image(width + 150, height - 230, 'daikon_boss');
		this.boss.setScale(0.6);
		this.boss.setDepth(10);
		this.boss.body.setAllowGravity(false);
		this.boss.setImmovable(true);

		// HP:20
		this.boss.hp = 20;

		// ボスの弾グループを作成
		this.bossBullets = this.physics.add.group({
			defaultKey: 'bossBullet',
			maxSize: 30
		});

		// ボスの弾 vs プレイヤー の当たり判定
		this.physics.add.overlap(this.player, this.bossBullets, (player, bullet) => {
			if (!bullet.active) return;
			bullet.destroy();
			
			// プレイヤーのダメージ処理（既存のメソッドを呼ぶ）
			this.hitObstacle(null); 
		});

		// --- 登場演出 ---
		// 画面右の定位置（ホームポジション）
		const homeX = width - 300; 
		// 攻撃時に迫ってくる位置（だいぶ左まで来る）
		const attackX = width - 450; 

		this.tweens.add({
			targets: this.boss,
			x: homeX,
			duration: 2500,
			ease: 'Power2',
			onComplete: () => {
				// --- 登場後の動き（2つの動きを同時に開始） ---

				// 動き1：縦に不気味にフワフワ（これはずっと続く）
				this.tweens.add({
					targets: this.boss,
					y: this.boss.y + 20,
					duration: 1800,
					yoyo: true,
					repeat: -1,
					ease: 'Sine.easeInOut'
				});

				// 動き2：プレイヤーへの突撃ループ
				this.tweens.add({
					targets: this.boss,
					x: attackX,     // ここまで迫ってくる
					duration: 3000, // 3秒かけてじわじわ迫る
					ease: 'Sine.easeInOut',
					yoyo: true,     // 自動で戻る
					repeat: -1,     // 無限ループ
					hold: 1000,     // 迫った位置で1秒止まる（威圧）
					loopDelay: 2000 // 定位置に戻ったら2秒休む
				});

				// 動き3「大根おろしショット」発射タイマー
				// 2秒ごとに3Way弾を撃ってくる
				this.bossAttackEvent = this.time.addEvent({
					delay: 2000, // 2秒間隔
					loop: true,
					callback: () => {
						// ボスが生きていて、かつゲーム中でなければ撃たない
						if (!this.boss || !this.boss.active || this.isGameOver) return;
						this.fireBossBullets();
					}
				});				
			}
		});

		// メッセージ
		if (this.messageText) {
			this.messageText.setText('ダイコンBOSS：私を倒してみろ');
		}

		// --- 当たり判定関係 ---

		// 1. プレイヤーとの接触（即死）
		this.physics.add.overlap(this.player, this.boss, () => {
			if (this.isGameOver) return;
			this.player.setTint(0xff0000);
			this.gameOver('ダイコンの圧倒的圧力に屈した…');
		});

		// 2. 弾との接触（ダメージ）
		this.physics.add.overlap(this.bullets, this.boss, (boss, bullet) => {
			if (!bullet.active || !boss.active) return;

			bullet.destroy();
			boss.hp -= 1;

			// ヒット演出
			boss.setTint(0xffaaaa);
			this.time.delayedCall(100, () => {
				if (boss.active) boss.clearTint();
			});

			if (boss.hp <= 0) {
				this.defeatBoss();
			}
		});
	}

	// -------------------------
	// ボスの攻撃（3Way弾）
	// -------------------------
	fireBossBullets() {
		if (!this.boss || !this.boss.active) return;

		// 弾の発射位置（ボスの中心より少し左）
		const x = this.boss.x - 60;
		const y = this.boss.y;

		// 3発発射（上・左・下）
		const angles = [160, 180, 200]; // 角度
		const speed = 300; // 弾の速さ

		angles.forEach(angle => {
			const bullet = this.bossBullets.get(x, y);
			if (bullet) {
				bullet.setActive(true).setVisible(true);
				bullet.body.enable = true;
				bullet.body.setAllowGravity(false); // 重力なし
				
				// 角度をベクトルに変換して飛ばす
				const rad = Phaser.Math.DegToRad(angle);
				this.physics.velocityFromRotation(rad, speed, bullet.body.velocity);
				
				// 3秒で消す
				this.time.delayedCall(3000, () => {
					if (bullet.active) bullet.destroy();
				});
			}
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
	// ダメージ処理
	// -------------------------
	hitObstacle(obs) {
		// ★デバッグ無敵モードなら何もしない
		if (this.isDebugInvincible) return;

		const now = this.time.now;
		if (now < this.invincibleUntil) return;

		// ダメージ 1
		this.hp -= 1;
		this.invincibleUntil = now + 1000; // 無敵時間（1秒）

		// 共通演出：ヒットストップ的揺れ
		this.cameras.main.shake(80, 0.004);
		
		// ライフに応じた色変化（Tint）
		// 初期(3)は白(Tintなし)、減るごとに青→赤へ
		if (this.hp === 2) {
			// 1回当たった（残り2）：水色っぽく
			this.player.setTint(0x88ccff);
		} else if (this.hp === 1) {
			// 2回当たった（残り1）：濃い青（ピンチ感）
			this.player.setTint(0x4444ff);
		} else if (this.hp <= 0) {
			// 3回当たった（残り0）：赤
			this.player.setTint(0xff0000);
			this.gameOver('コンニャクは力尽きた…');
			return; // ゲームオーバー処理へ
		}

		// 無敵時間中の点滅アニメーション（Tweenで点滅）
		this.tweens.add({
			targets: this.player,
			alpha: 0.2,
			duration: 100,
			yoyo: true,
			repeat: 4, // 1秒間チカチカさせる
			onComplete: () => {
				this.player.setAlpha(1); // 透明度を戻す
				// 色はHPの状態のまま維持されます
			}
		});
	}

	// -------------------------
	// ボス撃破時の処理
	// -------------------------
	defeatBoss() {
		// 爆発エフェクトの代わりに、少し揺らしてから消すなどの演出も可能ですが
		// まずはシンプルに消滅させます
		
		if (this.boss) {
			this.boss.destroy();
			this.boss = null; // 変数も空にしておく
		}

		// メッセージの更新
		// もし鍋（ゴール）が既に出ているなら「鍋へジャンプ！」に書き換え
		if (this.goalOpened) {
			if (this.messageText) this.messageText.setText('鍋へジャンプ！');
		} else {
			// まだ鍋が出ていない場合（60秒未満で倒した場合）
			// 鍋が出るまで待機中のメッセージにする
			if (this.messageText) this.messageText.setText('鍋の出現を待て…');
		}

		// (オプション) 倒したときの音や画面揺れを入れるならここ
		this.cameras.main.shake(150, 0.01);
	}

	// -------------------------
	// ゴール解放（鍋へジャンプ）
	// -------------------------
	openGoal() {
		this.goalOpened = true;

		// 敵の追加を止める
		if (this.spawnEvent) this.spawnEvent.remove(false);

		// ★修正：ボスが生きていたら「鍋へジャンプ」のメッセージを出さない
		// （ボスがいない時だけメッセージを出す）
		if (!this.boss || !this.boss.active) {
			if (this.messageText) this.messageText.setText('鍋へジャンプ！');
		}

		// 鍋表示（ボスがいる時でも、鍋自体は見えていたほうが「守ってる感」が出ます）
		this.pot.setVisible(true);
		
		// ★補足：もし「ボスを倒すまでゴール判定も無効にしたい」場合は
		// ここも if (!this.boss) { ... } で囲ってください。
		// 今はテスト用に「隙間をくぐればクリアできる」状態にしておきます。
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

		this.add.text(
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

		const keyR = this.input.keyboard.addKey(Phaser.Input.Keyboard.KeyCodes.R);
		keyR.once('down', () => this.scene.restart());
	}

	gameOver(msg) {
		// フラグを立てる
		this.isGameOver = true;

		// 敵スポーンのタイマーを停止
		if (this.spawnEvent) {
			this.spawnEvent.remove(false);
			this.spawnEvent = null;
		}

		// フェーズ進行チェックのタイマーを停止
		if (this.phaseEvent) {
			this.phaseEvent.remove(false);
			this.phaseEvent = null;
		}

		this.physics.pause();

		const { width, height } = this.scale;
		this.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.45).setDepth(90);

		this.add.text(
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

		this.add.text(
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

	//--------------------------------------------
	// 共通部品（あとで外部モジュール化しても良い）
	//--------------------------------------------
	// ステージ開始バナー表示
	showStageBanner(text) {
		const { width } = this.scale;
		const t = this.add.text(width / 2, 60, text, {
			fontFamily: 'sans-serif',
			fontSize: '24px',
			color: '#ffffff',
			stroke: '#000000',
			strokeThickness: 6,
		}).setOrigin(0.5).setDepth(999);

		this.tweens.add({
			targets: t,
			alpha: 0,
			duration: 600,
			delay: 1200,
			onComplete: () => t.destroy(),
		});
	}

	// 操作説明表示
	showControls(text) {
		if (this.controlsText) this.controlsText.destroy();

		this.controlsText = this.add.text(16, 12, text, {
			fontFamily: 'sans-serif',
			fontSize: '18px',
			color: '#000',
			backgroundColor: '#ffffffcc',
			padding: { left: 10, right: 10, top: 6, bottom: 6 },
		}).setDepth(1000);

		this.controlsText.setScrollFactor(0); // カメラが動いても固定
	}

	// 共通キー設定（R: リスタート、T: タイトルへ）
	setupCommonKeys() {
		this.keyR = this.input.keyboard.addKey(
			Phaser.Input.Keyboard.KeyCodes.R
		);
		this.keyT = this.input.keyboard.addKey(
			Phaser.Input.Keyboard.KeyCodes.T
		);
	}

	updateCommonKeys() {
		if (Phaser.Input.Keyboard.JustDown(this.keyR)) {
			this.scene.restart();
		}
		if (Phaser.Input.Keyboard.JustDown(this.keyT)) {
			this.goToTitle();
		}
	}

	goToTitle() {
		// TitleScene.js で設定している key: 'Title' に合わせる
		this.scene.start('Title');
	}    
}
