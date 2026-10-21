function c = ilab_list(s)
%ILAB_LIST Struct array -> cell row, so jsonencode always writes a JSON array
%   (a 1x1 struct array would otherwise become a single object).
c = num2cell(s(:)');
end
