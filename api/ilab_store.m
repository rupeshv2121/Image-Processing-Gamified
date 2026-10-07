function out = ilab_store(action, varargin)
%ILAB_STORE Image store shared by the UI and MATLAB.
%   Images are exchanged with the user interface as PNG files identified by
%   a short id. MATLAB loads them, processes them and saves the result as a
%   new id.
%
%   ilab_store('init', folder)    set the storage folder
%   ilab_store('dir')             current storage folder
%   I  = ilab_store('load', id)   read an image as double [0,1]
%   id = ilab_store('save', I, tag)  write an image, return its new id

persistent storeDir
if isempty(storeDir)
    storeDir = fullfile(fileparts(fileparts(mfilename('fullpath'))), 'runtime', 'images');
end

switch action
    case 'init'
        storeDir = varargin{1};
        if ~isfolder(storeDir), mkdir(storeDir); end
        out = storeDir;

    case 'dir'
        if ~isfolder(storeDir), mkdir(storeDir); end
        out = storeDir;

    case 'path'
        out = fullfile(storeDir, [checkId(varargin{1}) '.png']);

    case 'load'
        file = fullfile(storeDir, [checkId(varargin{1}) '.png']);
        if ~isfile(file)
            error('ImageLab:noImage', ...
                'The image is no longer available. Please load an image again.');
        end
        out = toDouble(imread(file));

    case 'save'
        I = varargin{1};
        tag = 'img';
        if numel(varargin) > 1, tag = regexprep(varargin{2}, '[^A-Za-z0-9]', ''); end
        if ~isfolder(storeDir), mkdir(storeDir); end
        [~, unique] = fileparts(tempname);
        id = sprintf('%s_%s', tag, unique(end-11:end));
        if islogical(I)
            imwrite(I, fullfile(storeDir, [id '.png']));
        else
            imwrite(toUint8(I), fullfile(storeDir, [id '.png']));
        end
        out = id;

    otherwise
        error('ImageLab:internal', 'Unknown store action "%s".', action);
end
end

function id = checkId(id)
% Only allow simple ids so a request can never read files outside the store
if ~(ischar(id) || isstring(id)) || isempty(regexp(char(id), '^[A-Za-z0-9_\-]+$', 'once'))
    error('ImageLab:noImage', 'No image loaded. Load an image first.');
end
id = char(id);
end
