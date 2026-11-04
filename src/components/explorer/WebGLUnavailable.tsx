/**
 * Shown in place of the 3D scene when WebGL is unavailable or the renderer
 * failed to start. Flowlines can still be simulated from the side panel.
 */

import { useUIStore } from '../../store/ui-store';

interface WebGLUnavailableProps {
  /** 'unsupported': no WebGL context; 'crashed': the 3D renderer threw. */
  reason: 'unsupported' | 'crashed';
}

export default function WebGLUnavailable({ reason }: WebGLUnavailableProps) {
  const isZh = useUIStore((s) => s.language) === 'zh';

  const title = reason === 'unsupported'
    ? (isZh ? '无法显示三维视图' : '3D view unavailable')
    : (isZh ? '三维视图出错' : 'The 3D view stopped working');
  const body = reason === 'unsupported'
    ? (isZh
      ? '您的浏览器或设备不支持 WebGL，或已将其禁用。您仍可在右侧列表中选择冰流线并开始模拟。'
      : 'Your browser or device does not support WebGL, or it is turned off. You can still pick a flowline from the list and start a simulation.')
    : (isZh
      ? '三维渲染器无法启动。请尝试刷新页面；您仍可在右侧列表中选择冰流线并开始模拟。'
      : 'The 3D renderer could not start. Try reloading the page; you can still pick a flowline from the list and start a simulation.');

  return (
    <div
      className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-8 text-center"
      style={{ background: 'rgba(10, 43, 67, 0.92)', color: 'rgba(224, 242, 254, 0.9)' }}
      role="alert"
    >
      <div className="text-sm font-medium">{title}</div>
      <p className="text-xs max-w-sm leading-relaxed" style={{ color: 'rgba(148, 200, 230, 0.85)' }}>
        {body}
      </p>
    </div>
  );
}
