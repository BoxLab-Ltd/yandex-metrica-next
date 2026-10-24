// Budget what users ship: production builds, where dev diagnostics are stripped.
const production = config => ({
    ...config,
    transform: {
        ...config.transform,
        define: { 'process.env.NODE_ENV': '"production"' },
    },
})

const entry = (name, path, imports, limit) => ({
    name,
    path,
    import: imports,
    ignore: ['react', 'react-dom', 'next'],
    limit,
    modifyRolldownConfig: production,
})

export default [
    entry(
        'instrumentation-client: register + onRouterTransitionStart',
        'dist/client/index.js',
        '{ register, onRouterTransitionStart }',
        '5.5 kB',
    ),
    entry(
        'component: <YandexMetrica />',
        'dist/react/index.js',
        '{ YandexMetrica }',
        '5.6 kB',
    ),
    entry(
        'Pages Router: <YandexMetricaPages />',
        'dist/pages/index.js',
        '{ YandexMetricaPages }',
        '5.75 kB',
    ),
    entry('reachGoal alone', 'dist/index.js', '{ reachGoal }', '300 B'),
]
