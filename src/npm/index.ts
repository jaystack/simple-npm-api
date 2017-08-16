import ini = require('ini');
import execa = require('execa');
import { promisify } from 'util';
import { writeFile } from 'fs';
import { join } from 'path';

const exec = async (command, { cwd, stream }: { cwd: string; stream: NodeJS.WritableStream }) => {
  const promise = execa.shell(command, { cwd });
  if (stream) {
    promise.stdout.pipe(stream);
  }
  const result = await promise;
  return result.stdout;
};

const checkOptions = (possibleOptions: string[], options: object) => {
  if (Object.keys(options).some(optionKey => !possibleOptions.includes(optionKey)))
    throw new Error('Invalid npm command option');
};

const createOptionsString = (options: object) => {
  return Object.keys(options)
    .filter(key => options[key])
    .map(key => (typeof options[key] === 'boolean' ? `--${key}` : `--${key}=${options[key]}`))
    .join(' ');
};

const resolveArgs = args => {
  const options = args.find(arg => typeof arg === 'object') || {};
  const argumentList = args.filter(arg => typeof arg === 'string') || '';
  const callback = args.filter(arg => typeof arg === 'function') || (() => {});
  return { argumentList, options, callback };
};

const createCommand = (
  command: string,
  {
    cwd,
    stream,
    possibleOptions,
    postProcess = _ => _,
    postFixedOptions = {}
  }: {
    cwd: string;
    stream: NodeJS.WritableStream;
    possibleOptions?: string[];
    postProcess?: (value: string) => any;
    postFixedOptions?: object;
  }
) => {
  return (...args) => {
    const { argumentList, options, callback } = resolveArgs(args);
    if (possibleOptions) checkOptions(possibleOptions, options);
    const argumentString = argumentList.join(' ');
    const optionsString = createOptionsString({ ...options, ...postFixedOptions });
    return exec(`npm ${command} ${optionsString} ${argumentString}`, { cwd, stream })
      .then(postProcess)
      .then(result => {
        callback(null, result);
        return result;
      })
      .catch(error => {
        callback(error);
        throw error;
      });
  };
};

const init = (cwd: string) => (pkg: object) =>
  promisify(writeFile)(join(cwd, 'package.json'), JSON.stringify(pkg, null, 2));

const parseConfigValue = exp => {
  try {
    return exp ? eval(exp) : '';
  } catch (error) {
    return exp;
  }
};

const parseList = list => list.split('\n').filter(_ => _);

const npm = ({ cwd = process.cwd(), stream = null }: { cwd?: string; stream?: NodeJS.WritableStream } = {}) => {
  return {
    access: {
      // auth
      public: createCommand('access public', { cwd, stream }),
      restricted: createCommand('access restricted', { cwd, stream }),
      grant: createCommand('access grant', { cwd, stream }),
      revoke: createCommand('access revoke', { cwd, stream }),
      listPackages: createCommand('access ls-packages', { cwd, stream, postProcess: JSON.parse }),
      listCollaborators: createCommand('access ls-collaborators', { cwd, stream, postProcess: JSON.parse })
    },
    addUser: createCommand('adduser', { cwd, stream }), // auth
    login: createCommand('login', { cwd, stream }), // auth
    bin: createCommand('bin', { cwd, stream }),
    build: createCommand('build', { cwd, stream }),
    cache: {
      add: createCommand('cache add', { cwd, stream }),
      clean: createCommand('cache clean', { cwd, stream }),
      verify: createCommand('cache verify', { cwd, stream })
    },
    config: {
      get: createCommand('config get', { cwd, stream, postProcess: parseConfigValue }),
      set: createCommand('config set', { cwd, stream }),
      delete: createCommand('config delete', { cwd, stream }),
      list: createCommand('config list', { cwd, stream, postProcess: ini.parse })
    },
    dedupe: createCommand('dedupe', { cwd, stream }),
    deprecate: createCommand('deprecate', { cwd, stream }), // auth
    distTags: {
      // auth
      add: createCommand('dist-tag add', { cwd, stream }),
      remove: createCommand('dist-tag rm', { cwd, stream }),
      list: createCommand('dist-tag ls', { cwd, stream, postProcess: parseList })
    },
    init: init(cwd),
    install: createCommand('install', { cwd, stream }),
    link: createCommand('link', { cwd, stream }),
    list: createCommand('list', { cwd, stream }),
    outdated: createCommand('outdated', { cwd, stream }),
    owner: {
      // auth
      add: createCommand('owner add', { cwd, stream }),
      remove: createCommand('owner rm', { cwd, stream }),
      list: createCommand('owner ls', { cwd, stream, postProcess: parseList })
    },
    pack: createCommand('pack', { cwd, stream }),
    ping: createCommand('ping', { cwd, stream }),
    prefix: createCommand('prefix', { cwd, stream }),
    prune: createCommand('prune', { cwd, stream }),
    publish: createCommand('publish', { cwd, stream }),
    rebuild: createCommand('rebuild', { cwd, stream }),
    restart: createCommand('restart', { cwd, stream }),
    root: createCommand('root', { cwd, stream }),
    run: createCommand('run', { cwd, stream }),
    search: createCommand('search', { cwd, stream, postFixedOptions: { json: true }, postProcess: JSON.parse }),
    shrinkwrap: createCommand('shrinkwrap', { cwd, stream }),
    star: createCommand('star', { cwd, stream }),
    unstart: createCommand('unstar', { cwd, stream }),
    stars: createCommand('stars', { cwd, stream }),
    start: createCommand('start', { cwd, stream }),
    stop: createCommand('stop', { cwd, stream }),
    team: {
      create: createCommand('team create', { cwd, stream }),
      destroy: createCommand('team destroy', { cwd, stream }),
      add: createCommand('team add', { cwd, stream }),
      remove: createCommand('team rm', { cwd, stream }),
      list: createCommand('team ls', { cwd, stream, postProcess: JSON.parse })
    },
    test: createCommand('test', { cwd, stream }),
    uninstall: createCommand('uninstall', { cwd, stream }),
    unpublish: createCommand('unpublish', { cwd, stream }),
    update: createCommand('update', { cwd, stream }),
    version: createCommand('version', { cwd, stream }),
    view: createCommand('view', { cwd, stream }),
    show: createCommand('show', { cwd, stream }),
    info: createCommand('info', { cwd, stream }),
    whoAmI: createCommand('whoami', { cwd, stream })
  };
};

const commands = npm({ cwd: process.cwd(), stream: null });
Object.keys(commands).forEach(name => (npm[name] = commands[name]));
export default npm;
