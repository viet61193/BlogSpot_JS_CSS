$(document).ready(function () {
            var editor = ace.edit('fromeditor');
            editor.getSession().setMode('ace/mode/css');
            editor.setShowPrintMargin(false);

            var toEditor = ace.edit('toeditor');
            toEditor.getSession().setMode('ace/mode/css');
            toEditor.setShowPrintMargin(false);

            $('#convert').click(function () {
                var editorContent = editor.getValue();
                var formattedContent = vkbeautify.css(editorContent, '');
                toEditor.getSession().setValue(formattedContent);
            });

            $('#reset').click(function () {
                editor.getSession().setValue('');
                toEditor.getSession().setValue('');
            });

            $('#copy').click(function () {
                var toEditorContent = toEditor.getValue();

                var textarea = document.createElement('textarea');
                textarea.value = toEditorContent;
                document.body.appendChild(textarea);

                textarea.select();
                document.execCommand('copy');

                document.body.removeChild(textarea);

                alert('Nội dung đã được sao chép vào clipboard.');
            });
        });
