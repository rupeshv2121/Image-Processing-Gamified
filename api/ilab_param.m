function v = ilab_param(p, name, default)
%ILAB_PARAM Request parameter p.(name), or default when missing or empty.
if isstruct(p) && isfield(p, name) && ~isempty(p.(name))
    v = p.(name);
else
    v = default;
end
end
