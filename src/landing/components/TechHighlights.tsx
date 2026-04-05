interface TechHighlightsProps {
  lang: 'en' | 'zh';
}

const highlights = [
  {
    stat: '2nd Order',
    stat_zh: '\u4E8C\u9636',
    title_en: 'Blatter\u2013Pattyn Solver',
    title_zh: 'Blatter\u2013Pattyn \u6C42\u89E3\u5668',
    desc_en: 'Higher-order stress balance model used in production ice sheet research. Solves coupled velocity\u2013thickness evolution every frame.',
    desc_zh: '\u751F\u4EA7\u7EA7\u51B0\u76D6\u7814\u7A76\u4E2D\u4F7F\u7528\u7684\u9AD8\u9636\u5E94\u529B\u5E73\u8861\u6A21\u578B\u3002\u6BCF\u5E27\u6C42\u89E3\u8026\u5408\u7684\u901F\u5EA6\u2013\u539A\u5EA6\u6F14\u5316\u3002',
    color: 'var(--accent)',
  },
  {
    stat: '60 fps',
    stat_zh: '60 fps',
    title_en: 'Web Worker Physics',
    title_zh: 'Web Worker \u7269\u7406\u5F15\u64CE',
    desc_en: 'The entire physics engine runs off the main thread in a dedicated Web Worker. Smooth 60fps rendering while computing ice dynamics.',
    desc_zh: '\u6574\u4E2A\u7269\u7406\u5F15\u64CE\u5728\u4E13\u7528Web Worker\u4E2D\u79BB\u4E3B\u7EBF\u7A0B\u8FD0\u884C\u300260fps\u6D41\u7545\u6E32\u67D3\u4E0E\u51B0\u52A8\u529B\u5B66\u8BA1\u7B97\u5E76\u884C\u3002',
    color: 'var(--accent-teal)',
  },
  {
    stat: '100+',
    stat_zh: '100+',
    title_en: 'Antarctic Flowlines',
    title_zh: '\u5357\u6781\u6D41\u7EBF',
    desc_en: 'Real flowline data from Antarctica\u2019s major drainage basins, each derived from satellite velocity fields and BedMachine bedrock topography.',
    desc_zh: '\u6765\u81EA\u5357\u6781\u6D32\u4E3B\u8981\u6D41\u57DF\u7684\u771F\u5B9E\u6D41\u7EBF\u6570\u636E\uFF0C\u6BCF\u6761\u5747\u6E90\u81EA\u536B\u661F\u901F\u5EA6\u573A\u548CBedMachine\u57FA\u5CA9\u5730\u5F62\u3002',
    color: 'var(--accent-warm)',
  },
] as const;

export function TechHighlights({ lang }: TechHighlightsProps) {
  return (
    <section
      className="landing-section"
      style={{ background: 'var(--bg-deep)' }}
    >
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-12 scroll-reveal">
          <h2
            className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 text-glow"
            style={{ color: 'var(--text-primary)' }}
          >
            {lang === 'en' ? 'Real Science, Real-Time' : '\u771F\u5B9E\u79D1\u5B66\uFF0C\u5B9E\u65F6\u8BA1\u7B97'}
          </h2>
          <div className="section-divider" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {highlights.map((h, i) => (
            <div
              key={h.title_en}
              className="scroll-reveal-scale text-center md:text-left"
              style={{ '--reveal-delay': `${i * 120}ms` } as React.CSSProperties}
            >
              <div
                className="h-0.5 rounded-full mb-6 mx-auto md:mx-0"
                style={{ background: h.color, width: '40px' }}
              />
              <div
                className="font-data text-3xl md:text-4xl font-medium mb-2"
                style={{ color: h.color }}
              >
                {lang === 'en' ? h.stat : h.stat_zh}
              </div>
              <h3
                className="text-lg font-bold mb-2"
                style={{ color: 'var(--text-primary)' }}
              >
                {lang === 'en' ? h.title_en : h.title_zh}
              </h3>
              <p
                className="text-sm leading-relaxed"
                style={{ color: 'var(--text-secondary)' }}
              >
                {lang === 'en' ? h.desc_en : h.desc_zh}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
