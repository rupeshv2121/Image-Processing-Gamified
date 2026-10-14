function out = authManager(action, varargin)
%AUTHMANAGER Student and teacher sign-in: passwords, sessions, lock-out.
%
%   Sessions
%   r = authManager('login', identifier, password, claim)
%         identifier = roll number or name (not case sensitive). A student whose
%         account has no password yet gets error ImageLab:needsPassword; calling
%         again with claim = true makes the typed password theirs.
%   r = authManager('register', name, roll, password)   self sign-up (if allowed)
%   r = authManager('teacherLogin', pin)                 teacher session (PIN)
%   s = authManager('resolve', token)    session struct, or [] (no / expired token)
%   authManager('logout', token)
%       r = struct(token, role, profileId, name, mustChange)
%
%   Passwords
%   authManager('changePassword', profileId, oldPassword, newPassword)
%   p = authManager('resetPassword', profileId, newPassword)   teacher: '' = generate a
%                                        temporary password; student must change it
%   s = authManager('status')            per student: hasPassword, mustChange, lastLogin, locked
%   authManager('forget', profileId)     delete the account (profile deleted)
%
%   Security
%   * Passwords are never stored: PBKDF2-HMAC-SHA256, 120 000 iterations,
%     random 16-byte salt per password (data/accounts.mat).
%   * Session tokens: 256 random bits from java.security.SecureRandom, kept
%     only in MATLAB memory (a restart signs everybody out). Students: 12 h,
%     teacher: 8 h, both renewed while in use.
%   * 5 wrong passwords lock an account for 5 minutes (also the teacher PIN).
%   * Failed sign-ins give one generic message, so nobody can find out
%     which roll numbers exist.
%   The request's identity is ALWAYS taken from the session, never from what
%   the browser claims (see ilab_dispatch).

persistent sessions failures
if isempty(sessions), sessions = containers.Map('KeyType', 'char', 'ValueType', 'any'); end
if isempty(failures), failures = containers.Map('KeyType', 'char', 'ValueType', 'any'); end
TTL = struct('student', 12 * 3600, 'teacher', 8 * 3600);
MAX_FAILS = 5; LOCK_S = 300;

switch action
    case 'resolve'
        token = char(varargin{1});
        out = [];
        if isempty(regexp(token, '^[0-9a-f]{64}$', 'once')) || ~isKey(sessions, token), return; end
        s = sessions(token);
        t = nowS();
        if t > s.expires
            remove(sessions, token);
            return
        end
        if t - s.renewed > 60                     % sliding expiry
            s.expires = t + TTL.(s.role); s.renewed = t;
            sessions(token) = s;
        end
        out = s;

    case 'logout'
        token = char(varargin{1});
        if isKey(sessions, token), remove(sessions, token); end
        out = true;

    case 'login'
        ident = strtrim(char(varargin{1}));
        password = char(varargin{2});
        claim = numel(varargin) >= 3 && isequal(varargin{3}, true);
        pr = findProfile(ident);
        key = ['s:' lower(ident)];
        checkLock(failures, key);
        if isempty(pr), fail(failures, key, MAX_FAILS, LOCK_S); end
        A = loadAccounts();
        if ~isfield(A, pr.id) || isempty(A.(pr.id).hash)
            if ~claim
                error('ImageLab:needsPassword', ...
                    'Welcome, %s! Your account has no password yet - choose one now.', pr.name);
            end
            A.(pr.id) = newAccount(password, false);
            saveAccounts(A);
        else
            key = ['p:' pr.id];                   % lock the account, not the spelling
            checkLock(failures, key);
            if ~verify(A.(pr.id), password), fail(failures, key, MAX_FAILS, LOCK_S); end
        end
        clearFails(failures, key);
        A = loadAccounts();
        A.(pr.id).lastLogin = char(datetime('now', 'Format', 'yyyy-MM-dd HH:mm'));
        saveAccounts(A);
        out = openSession(sessions, 'student', pr, A.(pr.id).mustChange, TTL);

    case 'register'
        C = classroomManager('get');
        if ~C.selfRegister
            error('ImageLab:invalidParameter', 'Ask your teacher to create your account.');
        end
        name = char(varargin{1}); roll = strtrim(char(varargin{2})); password = char(varargin{3});
        if isempty(roll)
            error('ImageLab:invalidParameter', 'Please enter your roll number - you sign in with it.');
        end
        checkPassword(password);
        profileManager('add', name, roll);
        pr = findProfile(roll);
        A = loadAccounts();
        A.(pr.id) = newAccount(password, false);
        A.(pr.id).lastLogin = char(datetime('now', 'Format', 'yyyy-MM-dd HH:mm'));
        saveAccounts(A);
        out = openSession(sessions, 'student', pr, false, TTL);

    case 'teacherLogin'
        key = 'teacher';
        checkLock(failures, key);
        if ~classroomManager('checkPin', char(varargin{1})), fail(failures, key, MAX_FAILS, LOCK_S); end
        clearFails(failures, key);
        out = openSession(sessions, 'teacher', struct('id', 'teacher', 'name', 'Teacher'), false, TTL);

    case 'changePassword'
        id = char(varargin{1}); old = char(varargin{2}); new = char(varargin{3});
        A = loadAccounts();
        if ~isfield(A, id)
            error('ImageLab:invalidParameter', 'This account has no password yet.');
        end
        if ~A.(id).mustChange && ~verify(A.(id), old)
            error('ImageLab:invalidParameter', 'Your current password is not correct.');
        end
        if verify(A.(id), new)
            error('ImageLab:invalidParameter', 'Choose a password that is different from the current one.');
        end
        A.(id) = newAccount(new, false, A.(id));
        saveAccounts(A);
        out = true;

    case 'resetPassword'
        id = char(varargin{1});
        password = char(varargin{2});
        if isempty(password), password = temporaryPassword(); end
        if ~any(strcmp({profileManager('roster').id}, id))
            error('ImageLab:invalidParameter', 'That student no longer exists.');
        end
        A = loadAccounts();
        prev = []; if isfield(A, id), prev = A.(id); end
        A.(id) = newAccount(password, true, prev);
        saveAccounts(A);
        endSessions(sessions, id);                % the old password no longer works anywhere
        clearFails(failures, ['p:' id]);
        out = struct('password', password);

    case 'status'
        A = loadAccounts();
        roster = profileManager('roster');
        out = cell(1, numel(roster));
        t = nowS();
        for k = 1:numel(roster)
            id = roster(k).id;
            e = struct('id', id, 'hasPassword', false, 'mustChange', false, 'lastLogin', '', 'locked', false);
            if isfield(A, id) && ~isempty(A.(id).hash)
                e.hasPassword = true; e.mustChange = A.(id).mustChange; e.lastLogin = A.(id).lastLogin;
            end
            if isKey(failures, ['p:' id]), f = failures(['p:' id]); e.locked = f.until > t; end
            out{k} = e;
        end

    case 'forget'
        id = char(varargin{1});
        A = loadAccounts();
        if isfield(A, id), A = rmfield(A, id); saveAccounts(A); end
        endSessions(sessions, id);
        out = true;

    otherwise
        error('ImageLab:internal', 'Unknown auth action "%s".', action);
end
end

% =========================================================================
function r = openSession(sessions, role, pr, mustChange, TTL)
if sessions.Count > 5000, purge(sessions); end
token = randomHex(32);
t = nowS();
sessions(token) = struct('role', role, 'profileId', pr.id, 'name', pr.name, ...
    'expires', t + TTL.(role), 'renewed', t);
r = struct('token', token, 'role', role, 'profileId', pr.id, 'name', pr.name, 'mustChange', mustChange);
end

function endSessions(sessions, id)
k = keys(sessions);
for j = 1:numel(k)
    if strcmp(sessions(k{j}).profileId, id), remove(sessions, k{j}); end
end
end

function purge(sessions)
k = keys(sessions); t = nowS();
for j = 1:numel(k)
    if sessions(k{j}).expires < t, remove(sessions, k{j}); end
end
end

function pr = findProfile(ident)
% Roll number first (unique), then the exact name - both not case sensitive
pr = [];
if isempty(ident), return; end
roster = profileManager('roster');
idx = find(strcmpi({roster.roll}, ident) & ~cellfun(@isempty, {roster.roll}), 1);
if isempty(idx), idx = find(strcmpi({roster.name}, ident), 1); end
if ~isempty(idx), pr = roster(idx); end
end

function checkLock(failures, key)
if isKey(failures, key)
    f = failures(key);
    wait = ceil((f.until - nowS()) / 60);
    if wait > 0
        error('ImageLab:locked', 'Too many wrong attempts. Try again in %d minute%s.', wait, plural(wait));
    end
end
end

function fail(failures, key, maxFails, lockS)
f = struct('count', 0, 'until', 0);
if isKey(failures, key), f = failures(key); end
f.count = f.count + 1;
if f.count >= maxFails, f.until = nowS() + lockS; f.count = 0; end
failures(key) = f;
if strcmp(key, 'teacher')
    error('ImageLab:teacherPin', 'Wrong teacher PIN.');
end
error('ImageLab:badLogin', 'Wrong roll number / name or password.');
end

function clearFails(failures, key)
if isKey(failures, key), remove(failures, key); end
end

% ------------------------------------------------------------------ hashing
function a = newAccount(password, mustChange, prev)
checkPassword(password);
salt = randomHex(16);
a = struct('salt', salt, 'hash', pbkdf2(password, salt, 120000), 'iterations', 120000, ...
    'mustChange', mustChange, 'lastLogin', '', ...
    'changed', char(datetime('now', 'Format', 'yyyy-MM-dd HH:mm')));
if nargin > 2 && isstruct(prev) && isfield(prev, 'lastLogin'), a.lastLogin = prev.lastLogin; end
end

function tf = verify(a, password)
if isempty(a.hash) || isempty(password), tf = false; return; end
h = pbkdf2(password, a.salt, a.iterations);
tf = numel(h) == numel(a.hash) && ~any(h ~= a.hash);   % compare every character
end

function h = pbkdf2(password, saltHex, iterations)
persistent factory
if isempty(factory), factory = javax.crypto.SecretKeyFactory.getInstance('PBKDF2WithHmacSHA256'); end
salt = typecast(uint8(sscanf(saltHex, '%2x')'), 'int8');
spec = javax.crypto.spec.PBEKeySpec(java.lang.String(password).toCharArray(), salt, iterations, 256);
key = typecast(factory.generateSecret(spec).getEncoded(), 'uint8');
spec.clearPassword();
h = lower(reshape(dec2hex(key, 2).', 1, []));
end

function s = randomHex(nBytes)
% MATLAB passes arrays to Java by value, so draw 64-bit numbers instead of filling a buffer
persistent rng_
if isempty(rng_), rng_ = java.security.SecureRandom(); end
s = '';
for k = 1:ceil(nBytes / 8)
    s = [s sprintf('%016x', typecast(int64(rng_.nextLong()), 'uint64'))]; %#ok<AGROW>
end
s = s(1:2 * nBytes);
end

function p = temporaryPassword()
% 8 easy-to-read characters (no 0/O, 1/l/I)
chars = 'abcdefghjkmnpqrstuvwxyz23456789';
h = randomHex(8);
p = chars(mod(sscanf(h, '%2x')', numel(chars)) + 1);
end

function checkPassword(p)
if numel(p) < 6 || numel(p) > 64
    error('ImageLab:invalidParameter', 'The password must have 6 to 64 characters.');
end
end

% ------------------------------------------------------------------ storage
function A = loadAccounts()
A = struct();
s = dataCache('load', accountsFile());
if isstruct(s) && isfield(s, 'A'), A = s.A; end
end

function saveAccounts(A) %#ok<INUSD> - saved by variable name
f = accountsFile();
if ~isfolder(fileparts(f)), mkdir(fileparts(f)); end
save(f, 'A');
dataCache('put', f, struct('A', A));
end

function f = accountsFile()
persistent file
if isempty(file), file = fullfile(fileparts(fileparts(mfilename('fullpath'))), 'data', 'accounts.mat'); end
f = file;
end

function t = nowS()
t = now * 86400;
end

function s = plural(n)
if n == 1, s = ''; else, s = 's'; end
end
