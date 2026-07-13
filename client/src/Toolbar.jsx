import { useRef } from 'react';
import { uploadImage } from './images.js';

const Btn = ({ on, act, title, children }) => (
  <button className={'tb' + (act ? ' act' : '')} onMouseDown={(e) => e.preventDefault()} onClick={on} title={title}>{children}</button>
);

export default function Toolbar({ editor, token }) {
  const fileRef = useRef();
  const c = () => editor.chain().focus();
  const inTable = editor.isActive('table');

  async function pickImage(e) {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    const url = await uploadImage(f, token);
    if (url) c().setImage({ src: url }).run();
  }

  function setLink() {
    const prev = editor.getAttributes('link').href || '';
    const url = window.prompt('כתובת הקישור:', prev);
    if (url === null) return;
    url ? c().extendMarkRange('link').setLink({ href: url }).run() : c().extendMarkRange('link').unsetLink().run();
  }

  return (
    <div className="toolbar">
      <Btn on={() => c().undo().run()} title="ביטול">↶</Btn>
      <Btn on={() => c().redo().run()} title="חזרה">↷</Btn>
      <span className="sep" />
      <select className="tb-select" title="סגנון"
        value={editor.isActive('heading', { level: 1 }) ? 'h1' : editor.isActive('heading', { level: 2 }) ? 'h2' : editor.isActive('heading', { level: 3 }) ? 'h3' : 'p'}
        onChange={(e) => {
          const v = e.target.value;
          v === 'p' ? c().setParagraph().run() : c().setHeading({ level: +v[1] }).run();
        }}>
        <option value="p">טקסט רגיל</option>
        <option value="h1">כותרת 1</option>
        <option value="h2">כותרת 2</option>
        <option value="h3">כותרת 3</option>
      </select>
      <span className="sep" />
      <Btn on={() => c().toggleBold().run()} act={editor.isActive('bold')} title="מודגש"><b>B</b></Btn>
      <Btn on={() => c().toggleItalic().run()} act={editor.isActive('italic')} title="נטוי"><i>I</i></Btn>
      <Btn on={() => c().toggleUnderline().run()} act={editor.isActive('underline')} title="קו תחתון"><u>U</u></Btn>
      <Btn on={() => c().toggleStrike().run()} act={editor.isActive('strike')} title="קו חוצה"><s>S</s></Btn>
      <label className="tb color-pick" title="צבע טקסט">
        <span style={{ color: editor.getAttributes('textStyle').color || 'inherit' }}>A</span>
        <input type="color" value={editor.getAttributes('textStyle').color || '#1f2328'}
          onChange={(e) => c().setColor(e.target.value).run()} />
      </label>
      <label className="tb color-pick hl" title="מרקר">
        <span style={{ background: editor.getAttributes('highlight').color || '#fde047' }}>A</span>
        <input type="color" value={editor.getAttributes('highlight').color || '#fde047'}
          onChange={(e) => c().setHighlight({ color: e.target.value }).run()} />
      </label>
      <Btn on={() => c().unsetColor().unsetHighlight().run()} title="ניקוי צבעים">⌫</Btn>
      <span className="sep" />
      <Btn on={() => c().setTextAlign('right').run()} act={editor.isActive({ textAlign: 'right' })} title="יישור לימין">⇥</Btn>
      <Btn on={() => c().setTextAlign('center').run()} act={editor.isActive({ textAlign: 'center' })} title="מרכוז">☰</Btn>
      <Btn on={() => c().setTextAlign('left').run()} act={editor.isActive({ textAlign: 'left' })} title="יישור לשמאל">⇤</Btn>
      <span className="sep" />
      <Btn on={() => c().toggleBulletList().run()} act={editor.isActive('bulletList')} title="רשימה">•≡</Btn>
      <Btn on={() => c().toggleOrderedList().run()} act={editor.isActive('orderedList')} title="רשימה ממוספרת">1≡</Btn>
      <Btn on={() => c().toggleTaskList().run()} act={editor.isActive('taskList')} title="רשימת משימות">☑</Btn>
      <Btn on={() => c().toggleBlockquote().run()} act={editor.isActive('blockquote')} title="ציטוט">”</Btn>
      <Btn on={() => c().setHorizontalRule().run()} title="קו מפריד">—</Btn>
      <span className="sep" />
      <Btn on={setLink} act={editor.isActive('link')} title="קישור">🔗</Btn>
      <Btn on={() => fileRef.current.click()} title="תמונה">🖼</Btn>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={pickImage} />
      <Btn on={() => c().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run()} title="טבלה">⊞</Btn>
      {inTable && (
        <span className="table-ops">
          <Btn on={() => c().addRowAfter().run()} title="הוספת שורה">+שורה</Btn>
          <Btn on={() => c().addColumnAfter().run()} title="הוספת עמודה">+עמודה</Btn>
          <Btn on={() => c().deleteRow().run()} title="מחיקת שורה">−שורה</Btn>
          <Btn on={() => c().deleteColumn().run()} title="מחיקת עמודה">−עמודה</Btn>
          <Btn on={() => c().mergeOrSplit().run()} title="מיזוג/פיצול תאים">⧉</Btn>
          <Btn on={() => c().deleteTable().run()} title="מחיקת טבלה">✕</Btn>
        </span>
      )}
    </div>
  );
}
