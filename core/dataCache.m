function out = dataCache(action, file, value)
%DATACACHE In-memory cache of small .mat data files (progress, profiles, settings).
%   s = dataCache('load', file)     load(file) - from memory while the file is
%                                   unchanged (same modification time and size)
%   dataCache('put', file, s)       remember what was just saved to file
%   dataCache('forget', file)       drop one file (after deleting it)
%   dataCache('clear')              drop everything
%
%   The class views read every student's progress file on each request;
%   with this cache a file is read from disk only after it was written, so
%   those views stay fast for hundreds of students. Writers call 'put'
%   right after save, so a second save within the file-system timestamp
%   resolution can never leave a stale entry behind.
%   'load' returns [] when the file does not exist.
%   An entry younger than RECHECK seconds is trusted without asking the
%   file system (dir() costs ~1 ms per file - most of a class view); only
%   changes made OUTSIDE ImageLab can take that long to show up.

RECHECK = 5;
persistent store
if isempty(store), store = containers.Map('KeyType', 'char', 'ValueType', 'any'); end

switch action
    case 'load'
        if isKey(store, file)
            e = store(file);
            if toc(e.checked) < RECHECK
                out = e.value;
                return
            end
        end
        info = dir(file);
        stamp = [];                                 % [] = the file does not exist
        if ~isempty(info), stamp = [info.datenum, info.bytes]; end
        if isKey(store, file)
            e = store(file);
            if isequal(e.stamp, stamp)
                e.checked = tic;
                store(file) = e;
                out = e.value;
                return
            end
        end
        out = [];
        if ~isempty(stamp), out = load(file); end
        store(file) = struct('stamp', stamp, 'value', out, 'checked', tic);
        trim(store);

    case 'put'
        info = dir(file);
        if ~isempty(info)
            store(file) = struct('stamp', [info.datenum, info.bytes], 'value', value, 'checked', tic);
            trim(store);
        end
        out = value;

    case 'forget'                               % the file was deleted
        store(file) = struct('stamp', [], 'value', [], 'checked', tic);
        out = [];

    case 'clear'
        store = containers.Map('KeyType', 'char', 'ValueType', 'any');
        out = [];

    otherwise
        error('ImageLab:internal', 'Unknown dataCache action "%s".', action);
end
end

function trim(store)
% Keep memory bounded (more files than any class needs)
if store.Count > 2000
    k = keys(store);
    remove(store, k(1:store.Count - 1500));
end
end
