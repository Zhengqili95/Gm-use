import { useState } from 'preact/hooks';

// 外殼用的示範元件：確認 Preact 互動元件能在 Starlight 頁面裡正常運作。
// T-009 做好正式的練習元件後，連同第 1 課佔位頁裡的引用一起刪掉。
export default function IslandCheck() {
	const [count, setCount] = useState(0);
	return (
		<div class="vl-island-check">
			<button type="button" onClick={() => setCount(count + 1)}>
				收藏
			</button>
			<span aria-live="polite">{count === 0 ? '還沒有人收藏' : `已收藏 ${count} 次`}</span>
		</div>
	);
}
