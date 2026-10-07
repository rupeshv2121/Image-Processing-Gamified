function J = applyPerChannel(fn, I)
%APPLYPERCHANNEL Apply a 2-D image operation to every colour channel.
%   J = applyPerChannel(@(X) someFilter(X), I) runs the function handle on
%   each channel of I independently and stacks the results.

I = toDouble(I);
J = zeros(size(I));
for c = 1:size(I, 3)
    J(:,:,c) = fn(I(:,:,c));
end
end
