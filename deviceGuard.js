/**
 * スマホ対応・共通ガード関数
 */

export function isMobileLike(scene) {
	return (
		scene.sys.game.device.os.android ||
		scene.sys.game.device.os.iOS ||
		scene.sys.game.device.os.iPad ||
		scene.sys.game.device.input.touch
	);
}

export function showMobileBlock(
	scene,
	message = 'このステージはPC向けです。\nPCブラウザで開いてください。'
) {
	// ① 音を止める
	scene.sound.stopAll();

	// ② 入力を止める
	scene.input.enabled = false;

	// ③ 画面中央に案内
	const { width, height } = scene.scale;

	const bg = scene.add.rectangle(width / 2, height / 2, width, height, 0x000000, 0.6);
	const text = scene.add.text(width / 2, height / 2, message, {
		fontSize: '18px',
		color: '#ffffff',
		align: 'center',
		lineSpacing: 6
	}).setOrigin(0.5);

	return { bg, text };
}
