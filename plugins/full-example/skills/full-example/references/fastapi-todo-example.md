# Worked answer: build a FastAPI todo API with tests

## How it was built

| Item | Value |
|---|---|
| Request | `/full-example Build a FastAPI todo API with tests` |
| Mode | Build |
| Environment | Python 3.13, run locally |
| Pinned packages | fastapi==0.115.6, uvicorn==0.34.0, pytest==8.3.4, httpx==0.28.1 |
| Verified by | Running every command below; outputs are copied from the run |

---

This builds a small todo API with four endpoints and three tests, then runs it and calls each endpoint.

### 1. **Create the project and install packages**

```bash
mkdir todo-api && cd todo-api
python3 -m venv .venv && source .venv/bin/activate
pip install fastapi==0.115.6 uvicorn==0.34.0 pytest==8.3.4 httpx==0.28.1
```

You should see: `Successfully installed ... fastapi-0.115.6 ... uvicorn-0.34.0`

### 2. **Create `main.py`**

```python
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI(title="Todo API")


class TodoIn(BaseModel):
    title: str
    done: bool = False


class Todo(TodoIn):
    id: int


todos: dict[int, Todo] = {}
next_id = 1


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/todos", status_code=201)
def create(item: TodoIn) -> Todo:
    global next_id
    todo = Todo(id=next_id, **item.model_dump())
    todos[next_id] = todo
    next_id += 1
    return todo


@app.get("/todos")
def list_todos() -> list[Todo]:
    return list(todos.values())


@app.patch("/todos/{todo_id}")
def mark_done(todo_id: int) -> Todo:
    if todo_id not in todos:
        raise HTTPException(status_code=404, detail="Todo not found")
    todos[todo_id].done = True
    return todos[todo_id]
```

### 3. **Create `test_main.py`**

```python
from fastapi.testclient import TestClient
from main import app

client = TestClient(app)


def test_health():
    assert client.get("/health").json() == {"status": "ok"}


def test_create_list_and_complete():
    r = client.post("/todos", json={"title": "Buy milk"})
    assert r.status_code == 201
    todo = r.json()
    assert todo == {"id": 1, "title": "Buy milk", "done": False}
    assert client.get("/todos").json() == [todo]
    assert client.patch("/todos/1").json()["done"] is True


def test_missing_todo_is_404():
    r = client.patch("/todos/999")
    assert r.status_code == 404
    assert r.json() == {"detail": "Todo not found"}
```

### 4. **Run the tests**

```bash
pytest -q
```

You should see: `3 passed, 1 warning`. The warning is a Starlette TestClient DeprecationWarning about anyio and is harmless.

### 5. **Start the server**

```bash
uvicorn main:app --port 8765
```

You should see: `Uvicorn running on http://127.0.0.1:8765 (Press CTRL+C to quit)`

### 6. **Call each endpoint (second terminal)**

```bash
curl -s localhost:8765/health
curl -s -X POST localhost:8765/todos -H 'Content-Type: application/json' -d '{"title":"Buy milk"}'
curl -s localhost:8765/todos
curl -s -X PATCH localhost:8765/todos/1 -H 'Content-Type: application/json' -d '{"done":true}'
curl -s -X PATCH localhost:8765/todos/9 -H 'Content-Type: application/json' -d '{"done":true}'
```

You should see, in order:

```
{"status":"ok"}
{"title":"Buy milk","done":false,"id":1}
[{"title":"Buy milk","done":false,"id":1}]
{"title":"Buy milk","done":true,"id":1}
{"detail":"Todo not found"}
```

## What the result should be

A running API on port 8765 that creates, lists and completes todos, returns 404 for an unknown id, and passes its three tests.

## Issues found

- Todos live in memory and are lost when the server stops.
- TestClient prints one DeprecationWarning under these pinned versions.

## Status

- VERIFIED: steps 1–6 were run; outputs above are copied from the run.
- DERIVED: none.
- BLOCKED: none.
- HUMAN ACTION: none.
