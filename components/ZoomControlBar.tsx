'use client'

function CameraIcon({ off }: { off: boolean }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        d="M3 7.5C3 6.67 3.67 6 4.5 6H13.5C14.33 6 15 6.67 15 7.5V16.5C15 17.33 14.33 18 13.5 18H4.5C3.67 18 3 17.33 3 16.5V7.5Z"
        stroke="currentColor"
        strokeWidth="1.6"
      />
      <path d="M15 10L20.2 7.2C20.55 7 21 7.26 21 7.66V16.34C21 16.74 20.55 17 20.2 16.8L15 14" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
      {off && <path d="M2 2L22 22" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />}
    </svg>
  )
}

function VideoRecordIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="3" y="6" width="12" height="12" rx="2.5" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="9" cy="12" r="2.5" fill="currentColor" />
      <path d="M15 10.5L20.2 7.6C20.55 7.4 21 7.66 21 8.06V15.94C21 16.34 20.55 16.6 20.2 16.4L15 13.5" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" />
    </svg>
  )
}

function AudioRecordIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="9" y="3" width="6" height="11" rx="3" stroke="currentColor" strokeWidth="1.6" />
      <path d="M5 11a7 7 0 0 0 14 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M12 18v3" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
    </svg>
  )
}

export default function ZoomControlBar({
  cameraOn,
  onToggleCamera,
  videoRecording,
  onToggleVideoRecording,
  audioRecording,
  onToggleAudioRecording,
}: {
  cameraOn: boolean
  onToggleCamera: () => void
  videoRecording: boolean
  onToggleVideoRecording: () => void
  audioRecording: boolean
  onToggleAudioRecording: () => void
}) {
  return (
    <div className="zoom-bar">
      <button className={`zoom-btn${cameraOn ? '' : ' off'}`} onClick={onToggleCamera} type="button">
        <CameraIcon off={!cameraOn} />
        <span>{cameraOn ? '카메라 끄기' : '카메라 켜기'}</span>
      </button>

      <button
        className={`zoom-btn${videoRecording ? ' recording' : ''}`}
        onClick={onToggleVideoRecording}
        disabled={!cameraOn}
        type="button"
        title={!cameraOn ? '카메라를 먼저 켜주세요' : undefined}
      >
        <VideoRecordIcon />
        <span>{videoRecording ? '화상 녹화 중지' : '화상 녹화'}</span>
      </button>

      <button
        className={`zoom-btn${audioRecording ? ' recording' : ''}`}
        onClick={onToggleAudioRecording}
        type="button"
      >
        <AudioRecordIcon />
        <span>{audioRecording ? '음성 녹음 중지' : '음성 녹음'}</span>
      </button>
    </div>
  )
}
