'use client'

// Uiverse.io by Priyanshu02020 스타일의 좋아요 버튼. 서버에 저장하지 않는 순수 재미용
// 위젯이라, 이 화면을 벗어나면 초기화된다(세션 리포트를 볼 때마다 다시 눌러볼 수 있다).
export default function LikeButton() {
  return (
    <label className="like-button">
      <input type="checkbox" className="on" aria-label="이 세션 좋아요" />
      <span className="like">
        <svg className="like-icon" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 21s-6.5-4.6-9.3-8.4C.6 9.8 1.4 6 4.6 4.7c2-.8 4.2-.1 5.4 1.6.4.5.7 1 1 1.5.3-.5.6-1 1-1.5 1.2-1.7 3.4-2.4 5.4-1.6 3.2 1.3 4 5.1 1.9 7.9C18.5 16.4 12 21 12 21z" />
        </svg>
        <span className="like-text">좋아요</span>
      </span>
      <span className="like-count one">0</span>
      <span className="like-count two">1</span>
    </label>
  )
}
